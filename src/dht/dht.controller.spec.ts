import { Test, TestingModule } from '@nestjs/testing';
import { DhtController } from './dht.controller';

describe('DhtController', () => {
  let controller: DhtController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DhtController],
    }).compile();

    controller = module.get<DhtController>(DhtController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
