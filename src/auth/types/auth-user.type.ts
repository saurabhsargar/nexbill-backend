import { Role } from '@prisma/client';

export interface AuthUser {
    id: string;
    role: Role;
    organizationId: string;
}
