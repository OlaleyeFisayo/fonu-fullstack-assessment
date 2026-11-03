import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { EnvConfigService } from "../../../shared/env";
import { User, UserRole } from "../entities/user.entity";

@Injectable()
export class AdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(ConfigService) private readonly config: EnvConfigService,
  ) {}

  async onApplicationBootstrap() {
    const email = this.config.get("ADMIN_EMAIL");
    const existing = await this.userRepo.findOneBy({ email });

    if (existing) {
      if (existing.role !== UserRole.ADMIN)
        throw new Error(`ADMIN_EMAIL ${email} belongs to a non-admin user`);
      return;
    }

    await this.userRepo.save(
      this.userRepo.create({
        name: this.config.get("ADMIN_NAME"),
        email,
        password: this.config.get("ADMIN_PASSWORD"),
        role: UserRole.ADMIN,
      }),
    );
    this.logger.log(`Seeded admin ${email}`);
  }
}
