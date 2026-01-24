import { RoleGuard } from '@/components/auth/RoleGuard';
import { UserType } from '@/lib/types/auth.types';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={[UserType.ORGANIZER, UserType.ADMIN, UserType.USER]}>
      {children}
    </RoleGuard>
  );
}
