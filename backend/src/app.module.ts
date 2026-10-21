import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';

@Module({ imports: [DatabaseModule, AuthModule, OrdersModule], controllers: [HealthController] })
export class AppModule {}
