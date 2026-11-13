import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

class EmailDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString()
  @IsEmail({ allow_utf8_local_part: false })
  @MaxLength(254)
  email!: string;
}

export class CredentialsDto extends EmailDto {
  @IsString()
  // Accept new registrations by code point count and preserve the legacy upper bound.
  @Matches(/^[\s\S]{12}/u)
  @MaxLength(128)
  password!: string;
}

export class RegistrationCredentialsDto extends EmailDto {
  @IsString()
  @Matches(/^[^\s\p{White_Space}]{12,128}$/u)
  password!: string;
}
