'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { User, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { ubahProfilAction, gantiPasswordAction } from '../actions';
import type { UserProfile } from '@/types/auth';

interface ProfilFormsProps {
  user: UserProfile;
}

export function ProfilForms({ user }: ProfilFormsProps) {
  const router = useRouter();
  const [isPendingNama, startTransitionNama] = React.useTransition();
  const [isPendingPassword, startTransitionPassword] = React.useTransition();

  const [fieldErrorsNama, setFieldErrorsNama] = React.useState<Record<string, string[]>>({});
  const [fieldErrorsPassword, setFieldErrorsPassword] = React.useState<Record<string, string[]>>({});

  const handleUpdateNama = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransitionNama(async () => {
      const res = await ubahProfilAction(null, formData);
      if (!res.success) {
        if (res.fieldErrors) setFieldErrorsNama(res.fieldErrors);
        toast.error(res.message || 'Gagal mengubah nama profil');
      } else {
        toast.success(res.message || 'Nama profil berhasil diperbarui');
        router.refresh();
      }
    });
  };

  const handleUpdatePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransitionPassword(async () => {
      const res = await gantiPasswordAction(null, formData);
      if (!res.success) {
        if (res.fieldErrors) setFieldErrorsPassword(res.fieldErrors);
        toast.error(res.message || 'Gagal mengganti kata sandi');
      } else {
        toast.success(res.message || 'Kata sandi berhasil diperbarui');
        form.reset();
        setFieldErrorsPassword({});
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Form Ubah Nama Profil */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-slate-100">
          <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-4 w-4 text-slate-500" />
            Ubah Identitas Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleUpdateNama} className="space-y-4">
            <FormField
              id="nama_lengkap"
              label="Nama Lengkap"
              required
              error={fieldErrorsNama.nama_lengkap?.[0]}
            >
              <Input
                id="nama_lengkap"
                name="nama_lengkap"
                defaultValue={user.nama_lengkap}
                required
                disabled={isPendingNama}
                onChange={() => setFieldErrorsNama({})}
              />
            </FormField>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" disabled={isPendingNama}>
                {isPendingNama ? 'Menyimpan...' : 'Simpan Nama'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Form Ganti Kata Sandi */}
      <Card>
        <CardHeader className="py-3 px-5 border-b border-slate-100">
          <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-slate-500" />
            Ganti Kata Sandi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <FormField
              id="password_baru"
              label="Kata Sandi Baru"
              required
              error={fieldErrorsPassword.password_baru?.[0]}
              hint="Minimal 6 karakter"
            >
              <Input
                id="password_baru"
                name="password_baru"
                type="password"
                required
                disabled={isPendingPassword}
                onChange={() => setFieldErrorsPassword({})}
              />
            </FormField>

            <FormField
              id="konfirmasi_password"
              label="Konfirmasi Kata Sandi Baru"
              required
              error={fieldErrorsPassword.konfirmasi_password?.[0]}
            >
              <Input
                id="konfirmasi_password"
                name="konfirmasi_password"
                type="password"
                required
                disabled={isPendingPassword}
                onChange={() => setFieldErrorsPassword({})}
              />
            </FormField>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" disabled={isPendingPassword}>
                {isPendingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
