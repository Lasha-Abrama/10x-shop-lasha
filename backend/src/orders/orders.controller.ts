import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthRequest } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Req() request: AuthRequest, @Body() input: CreateOrderDto) {
    return this.orders.create(this.userId(request), input);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest) { return this.orders.list(this.userId(request)); }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  find(@Req() request: AuthRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.find(this.userId(request), id);
  }

  private userId(request: AuthRequest): string {
    if (!request.user) throw new UnauthorizedException('Unauthorized');
    return request.user.id;
  }
}
