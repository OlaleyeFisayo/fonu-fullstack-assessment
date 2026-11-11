import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { verify } from "argon2";
import { IsNull, MoreThan, QueryFailedError } from "typeorm";
import { User, UserRole } from "../user/entities/user.entity";
import { JwtPayload } from "../../shared/types";
import { AuthService } from "./auth.service";
import { Token, TokenType } from "./entities/token.entity";

jest.mock("argon2", () => ({
  hash: jest.fn(async (v: string) => `hashed:${v}`),
  verify: jest.fn(),
}));

const verifyMock = verify as jest.Mock;

const user = (overrides: Partial<User> = {}) =>
  ({
    id: "u1",
    name: "Ada",
    email: "ada@test.com",
    password: "hashed:secret",
    role: UserRole.CUSTOMER,
    ...overrides,
  }) as User;

const CONFIG: Record<string, string> = {
  REFRESH_TOKEN_SECRET: "refresh-secret",
  REFRESH_TOKEN_EXPIRES_IN: "7d",
};

const EXP = 1_900_000_000;

type SignOptions = { jwtid: string; secret?: string; expiresIn?: string };
type TokenRow = { id: string; sessionId: string };

describe("AuthService", () => {
  let service: AuthService;
  const repo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(),
    update: jest.fn(),
  };
  const jwt = {
    sign: jest.fn((_payload, options?: SignOptions) =>
      options?.secret ? "refresh-token" : "access-token",
    ),
    decode: jest.fn(() => ({ exp: EXP })),
  };
  const manager = {
    insert: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  };
  const tokenRepo = {
    findOne: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
    manager,
  };

  const insertedRows = (call = 0) =>
    manager.insert.mock.calls[call][1] as TokenRow[];

  beforeEach(async () => {
    jest.clearAllMocks();
    manager.update.mockResolvedValue({ affected: 1 });
    manager.transaction.mockImplementation(
      (cb: (m: typeof manager) => unknown) => cb(manager),
    );
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: getRepositoryToken(Token), useValue: tokenRepo },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (k: string) => CONFIG[k] } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe("signUp", () => {
    const dto = { name: "Ada", email: "ada@test.com", password: "secret" };

    it("saves a new user", async () => {
      await service.signUp(dto);
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalledWith(dto);
    });

    it("throws Conflict when the email is taken", async () => {
      repo.save.mockRejectedValueOnce(
        new QueryFailedError(
          "INSERT",
          [],
          Object.assign(new Error("dup"), { code: "23505" }),
        ),
      );
      await expect(service.signUp(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("rethrows other database errors", async () => {
      repo.save.mockRejectedValueOnce(new Error("db down"));
      await expect(service.signUp(dto)).rejects.toThrow("db down");
    });
  });

  describe("login", () => {
    const dto = { email: "ada@test.com", password: "secret" };

    it("rejects an unknown email", async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException("User does not exist"),
      );
    });

    it("rejects a wrong password", async () => {
      repo.findOneBy.mockResolvedValue(user());
      verifyMock.mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException("Invalid Credentials"),
      );
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it("returns tokens and records both in the token table", async () => {
      repo.findOneBy.mockResolvedValue(user());
      verifyMock.mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result).toEqual({
        name: "Ada",
        role: UserRole.CUSTOMER,
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      const [[accessClaims, accessOpts], [refreshClaims, refreshOpts]] = jwt
        .sign.mock.calls as [{ sid: string }, SignOptions][];
      expect(refreshOpts).toMatchObject({
        secret: "refresh-secret",
        expiresIn: "7d",
      });
      expect(accessClaims).toEqual({
        userId: "u1",
        role: UserRole.CUSTOMER,
        sid: expect.any(String),
      });
      expect(refreshClaims).toEqual(accessClaims);
      expect(accessOpts.jwtid).not.toEqual(refreshOpts.jwtid);

      expect(manager.insert.mock.calls[0][0]).toBe(Token);
      expect(insertedRows()).toEqual([
        {
          id: accessOpts.jwtid,
          sessionId: accessClaims.sid,
          user: { id: "u1" },
          type: TokenType.ACCESS,
          expiresAt: new Date(EXP * 1000),
        },
        {
          id: refreshOpts.jwtid,
          sessionId: accessClaims.sid,
          user: { id: "u1" },
          type: TokenType.REFRESH,
          expiresAt: new Date(EXP * 1000),
        },
      ]);
    });

    it("starts a new session on every login", async () => {
      repo.findOneBy.mockResolvedValue(user());
      verifyMock.mockResolvedValue(true);
      await service.login(dto);
      await service.login(dto);
      expect(insertedRows(0)[0].sessionId).not.toEqual(
        insertedRows(1)[0].sessionId,
      );
    });
  });

  describe("verifyRefreshToken", () => {
    const claims = {
      userId: "u1",
      role: UserRole.CUSTOMER,
      jti: "r1",
      sid: "s1",
    };

    it("rejects a token without jti/sid", async () => {
      await expect(
        service.verifyRefreshToken({
          userId: "u1",
          role: UserRole.CUSTOMER,
        } as JwtPayload),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokenRepo.findOne).not.toHaveBeenCalled();
    });

    it("rejects a token that is not in the table", async () => {
      tokenRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyRefreshToken(claims)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(tokenRepo.findOne).toHaveBeenCalledWith({
        where: { id: "r1", type: TokenType.REFRESH, user: { id: "u1" } },
      });
    });

    it("revokes every session of the user when a revoked token is replayed", async () => {
      tokenRepo.findOne.mockResolvedValue({ id: "r1", revokedAt: new Date() });
      await expect(service.verifyRefreshToken(claims)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(manager.update).toHaveBeenCalledWith(
        Token,
        { user: { id: "u1" }, revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
    });

    it("throws NotFound when the user was deleted", async () => {
      tokenRepo.findOne.mockResolvedValue({ id: "r1", revokedAt: null });
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.verifyRefreshToken(claims)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the role from the database, not the token", async () => {
      tokenRepo.findOne.mockResolvedValue({ id: "r1", revokedAt: null });
      repo.findOneBy.mockResolvedValue(user({ role: UserRole.ADMIN }));
      await expect(service.verifyRefreshToken(claims)).resolves.toEqual({
        userId: "u1",
        role: UserRole.ADMIN,
        jti: "r1",
        sid: "s1",
      });
    });
  });

  describe("refreshToken", () => {
    const authUser = {
      userId: "u1",
      role: UserRole.CUSTOMER,
      jti: "r1",
      sid: "s1",
    };

    it("revokes the session's tokens and issues a new pair in the same session", async () => {
      const result = await service.refreshToken(authUser);

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
      expect(manager.update).toHaveBeenNthCalledWith(
        1,
        Token,
        { id: "r1", revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
      expect(manager.update).toHaveBeenNthCalledWith(
        2,
        Token,
        { sessionId: "s1", revokedAt: IsNull() },
        { revokedAt: expect.any(Date) },
      );
      expect(insertedRows().map((r) => r.sessionId)).toEqual(["s1", "s1"]);
    });

    it("rejects when the refresh token was already used concurrently", async () => {
      manager.update.mockResolvedValueOnce({ affected: 0 });
      await expect(service.refreshToken(authUser)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(manager.insert).not.toHaveBeenCalled();
    });
  });

  it("logout revokes only the current session", async () => {
    await service.logout("s1");
    expect(manager.update).toHaveBeenCalledWith(
      Token,
      { sessionId: "s1", revokedAt: IsNull() },
      { revokedAt: expect.any(Date) },
    );
  });

  it("isTokenActive only matches unrevoked, unexpired tokens of the given type", async () => {
    tokenRepo.exists.mockResolvedValue(true);
    await expect(service.isTokenActive("a1", TokenType.ACCESS)).resolves.toBe(
      true,
    );
    expect(tokenRepo.exists).toHaveBeenCalledWith({
      where: {
        id: "a1",
        type: TokenType.ACCESS,
        revokedAt: IsNull(),
        expiresAt: MoreThan(expect.any(Date)),
      },
    });
  });

  it("findUserById throws NotFound when missing", async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.findUserById("u1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
