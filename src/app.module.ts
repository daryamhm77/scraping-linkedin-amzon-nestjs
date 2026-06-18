import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AmazonModule } from './amazon/amazon.module';
import { LinkedinModule } from './linkedin/linkedin.module';

@Module({
  imports: [AmazonModule, LinkedinModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
