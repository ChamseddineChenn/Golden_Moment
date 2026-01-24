import { RoleGuard } from '@/components/auth/RoleGuard';
import { UserType } from '@/lib/types/auth.types';

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={[UserType.ADMIN, UserType.ORGANIZER, UserType.USER]}>
      {children}
    </RoleGuard>
  );
}
