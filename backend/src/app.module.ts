import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { WinstonModule } from 'nest-winston';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { GoalsModule } from './goals/goals.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TaxInsightsModule } from './tax-insights/tax-insights.module';
import { AiInsightsModule } from './ai-insights/ai-insights.module';
import { HealthModule } from './health/health.module';
import { AsyncJobsModule } from './async-jobs/async-jobs.module';
import { AccountantModule } from './accountant/accountant.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { winstonConfig } from './common/logger/winston.config';
import { CommonServicesModule } from './common/services/common-services.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WinstonModule.forRoot(winstonConfig),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: Number(process.env.THROTTLE_LIMIT) || 300,
      },
    ]),
    CacheModule.register({
      isGlobal: true,
      ttl: 300000, // 5 minutos
      max: 100, // máximo de 100 itens no cache
    }),
    PrismaModule,
    CommonServicesModule,
    AuthModule,
    UsersModule,
    TransactionsModule,
    CategoriesModule,
    GoalsModule,
    DashboardModule,
    TaxInsightsModule,
    AiInsightsModule,
    HealthModule,
    AsyncJobsModule,
    AccountantModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    ...(process.env.NODE_ENV === 'production'
      ? [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
      : []),
  ],
})
export class AppModule {}
