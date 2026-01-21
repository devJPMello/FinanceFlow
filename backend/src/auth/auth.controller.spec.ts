import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('deve registrar um novo usuário', async () => {
      const createUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResponse = {
        user: {
          id: '1',
          ...createUserDto,
          createdAt: new Date(),
        },
        token: 'mock-token',
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await controller.register(createUserDto);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(createUserDto);
    });

    it('deve lançar ConflictException se email já existe', async () => {
      const createUserDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      mockAuthService.register.mockRejectedValue(
        new ConflictException('Email já cadastrado'),
      );

      await expect(controller.register(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('deve fazer login com credenciais válidas', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockResponse = {
        user: {
          id: '1',
          email: loginDto.email,
          name: 'Test User',
          createdAt: new Date(),
        },
        token: 'mock-token',
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });

    it('deve lançar UnauthorizedException com credenciais inválidas', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Credenciais inválidas'),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
