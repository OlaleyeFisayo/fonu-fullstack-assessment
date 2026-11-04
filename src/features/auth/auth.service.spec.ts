import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { hash, verify } from "argon2";
import { User, UserRole } from "../user/entities/user.entity";
import { AuthService } from "./auth.service";

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
    hashedRefreshToken: "hashed:refresh",
    ...overrides,
  }) as User;

const CONFIG: Record<string, string> = {
  REFRESH_TOKEN_SECRET: "refresh-secret",
  REFRESH_TOKEN_EXPIRES_IN: "7d",
};

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
    sign: jest.fn((_payload, options?: { secret?: string }) =>
      options?.secret ? "refresh-token" : "access-token",
    ),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (k: string) => CONFIG[k] } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe("signUp", () => {
    const dto = { name: "Ada", email: "ada@test.com", password: "secret" };

    it("saves a new user", async () => {
      repo.findOne.mockResolvedValue(null);
      await service.signUp(dto);
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalledWith(dto);
    });

    it("throws Conflict when the email is taken", async () => {
      repo.findOne.mockResolvedValue(user());
      await expect(service.signUp(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
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
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("returns tokens and stores the hashed refresh token", async () => {
      repo.findOneBy.mockResolvedValue(user());
      verifyMock.mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result).toEqual({
        name: "Ada",
        role: UserRole.CUSTOMER,
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: "u1", role: UserRole.CUSTOMER },
        { secret: "refresh-secret", expiresIn: "7d" },
      );
      expect(hash).toHaveBeenCalledWith("refresh-token");
      expect(repo.update).toHaveBeenCalledWith(
        { id: "u1" },
        { hashedRefreshToken: "hashed:refresh-token" },
      );
    });
  });

  describe("verifyRefreshToken", () => {
    it("rejects an invalid or expired token", async () => {
      jwt.verifyAsync.mockRejectedValue(new Error("jwt expired"));
      await expect(
        service.verifyRefreshToken("u1", "bad"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.verifyAsync).toHaveBeenCalledWith("bad", {
        secret: "refresh-secret",
      });
    });

    it("throws NotFound when the user was deleted", async () => {
      jwt.verifyAsync.mockResolvedValue({});
      repo.findOneBy.mockResolvedValue(null);
      await expect(
        service.verifyRefreshToken("u1", "token"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects after logout", async () => {
      jwt.verifyAsync.mockResolvedValue({});
      repo.findOneBy.mockResolvedValue(user({ hashedRefreshToken: null }));
      await expect(
        service.verifyRefreshToken("u1", "token"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    });

    it("rejects an old token after rotation", async () => {
      jwt.verifyAsync.mockResolvedValue({});
      repo.findOneBy.mockResolvedValue(user());
      verifyMock.mockResolvedValue(false);
      await expect(
        service.verifyRefreshToken("u1", "old-token"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("returns the role from the database, not the token", async () => {
      jwt.verifyAsync.mockResolvedValue({ role: UserRole.CUSTOMER });
      repo.findOneBy.mockResolvedValue(user({ role: UserRole.ADMIN }));
      verifyMock.mockResolvedValue(true);
      await expect(service.verifyRefreshToken("u1", "token")).resolves.toEqual({
        userId: "u1",
        role: UserRole.ADMIN,
      });
    });
  });

  it("refreshToken rotates the stored hash", async () => {
    const result = await service.refreshToken({
      userId: "u1",
      role: UserRole.CUSTOMER,
    });
    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(repo.update).toHaveBeenCalledWith(
      { id: "u1" },
      { hashedRefreshToken: "hashed:refresh-token" },
    );
  });

  it("logout clears the stored refresh token", async () => {
    await service.logout("u1");
    expect(repo.update).toHaveBeenCalledWith(
      { id: "u1" },
      { hashedRefreshToken: null },
    );
  });

  it("findUserById throws NotFound when missing", async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.findUserById("u1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
