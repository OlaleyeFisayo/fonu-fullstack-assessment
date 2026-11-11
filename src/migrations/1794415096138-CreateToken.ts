import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateToken1794415096138 implements MigrationInterface {
  name = "CreateToken1794415096138";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."token_type_enum" AS ENUM('access', 'refresh')`,
    );
    await queryRunner.query(
      `CREATE TABLE "token" ("id" uuid NOT NULL, "sessionId" uuid NOT NULL, "type" "public"."token_type_enum" NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad320ba7ca56f342fcc2c7fcaf" ON "token"  ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_94f168faad896c0786646fa3d4" ON "token"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "hashedRefreshToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "token" ADD CONSTRAINT "FK_94f168faad896c0786646fa3d4a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "token" DROP CONSTRAINT "FK_94f168faad896c0786646fa3d4a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "hashedRefreshToken" character varying`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94f168faad896c0786646fa3d4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad320ba7ca56f342fcc2c7fcaf"`,
    );
    await queryRunner.query(`DROP TABLE "token"`);
    await queryRunner.query(`DROP TYPE "public"."token_type_enum"`);
  }
}
