import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AmazonModule } from './amazon/amazon.module';
import { LinkedinModule } from './linkedin/linkedin.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AmazonModule, LinkedinModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
