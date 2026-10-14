import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon, CircleAlertIcon } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { api, isMock } from "@/data/api";
import { DEMO_PASSWORD } from "@/data/seed";
import { useCountdown, useForm } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Brand, PageHeader } from "@/components/layout/AppShell";
import { CheckboxField, PasswordField, TextField } from "@/components/shared/fields";
import { FormDialog } from "@/components/shared/dialogs";
import { Panel, Spinner } from "@/components/shared/ui";
import { AdminHeader } from "@/domains/admin/shared";
import { useSession } from "./SessionProvider";
import {
  PASSWORD_HINT,
  validateChangePassword,
  validateEmail,
  validateLogin,
  validateNewPassword,
  validateRegister,
  validateWelcome,
} from "./validation";

function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh bg-[linear-gradient(-136deg,#003DA5_16%,#00266B_53%,#DC1C2E_84%)] p-2 sm:p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-6 rounded-[26px] bg-card px-5 py-5 sm:px-10 sm:pt-7 sm:pb-6">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <span className="text-[13px] font-semibold text-ink-3">
            Butuh bantuan? cs@ruangkpr.id
          </span>
        </div>
        <div className="grid flex-1 grid-cols-1 items-stretch gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative hidden flex-col justify-end overflow-hidden rounded-[22px] bg-muted p-9 lg:flex">
            <img
              src="/cover-auth.webp"
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
            <div
              className="absolute inset-0 bg-[linear-gradient(0deg,#0B1B33E6_0%,#0B1B3399_35%,#0B1B3300_65%)]"
              aria-hidden
            />
            <div className="relative flex flex-col gap-[18px]">
              <p className="text-[46px] leading-[52px] font-extrabold tracking-[-1.4px] text-white">
                Semua tentang
                <br />
                KPR kamu. Satu tempat.
              </p>
              <p className="max-w-[440px] text-[15px] leading-[23px] text-white/85">
                Dari rencana rumah pertama sampai mengelola cicilan, lanjutkan
                perjalananmu di sini.
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center py-6">
            <main className="flex w-full max-w-[440px] flex-col gap-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

const LEGAL = {
  terms: {
    title: "Syarat & Ketentuan",
    body: "RuangKPR membantu kamu memahami, mengajukan, dan memantau KPR. Semua hasil simulasi adalah estimasi dan bukan persetujuan kredit. Data hanya dikirim ke bank setelah kamu memilih satu program dan menekan Submit. Dokumen legal final masih menunggu review sebelum produksi.",
  },
  privacy: {
    title: "Kebijakan Privasi",
    body: "Data pribadi, penghasilan, dan dokumen hanya dipakai untuk analisis dan pengajuan yang kamu setujui. Kami tidak pernah meminta password, PIN, atau OTP perbankan kamu. " +
      (isMock
        ? "Pada mode demo ini data disimpan di browser kamu saja."
        : "Data disimpan di server RuangKPR dan hanya bisa dibuka olehmu serta tim yang memproses pengajuanmu."),
  },
};

function FormAlert({ children }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 text-[13px] font-semibold text-danger"
    >
      <CircleAlertIcon className="size-4" aria-hidden />
      {children}
    </p>
  );
}

function AuthHeading({ badge, title, children }) {
  return (
    <div className="flex flex-col gap-2.5">
      {badge && (
        <span className="w-fit rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-primary">
          {badge}
        </span>
      )}
      <h1 className="text-[32px] leading-[38px] font-extrabold tracking-[-0.7px]">
        {title}
      </h1>
      <p className="text-sm leading-[21px] text-ink-3">{children}</p>
    </div>
  );
}

function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-bold text-primary"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

// Looks disabled while the form is incomplete but stays clickable, so a tap shows what is missing; no API call happens.
function SubmitButton({ incomplete, pending, busyLabel, children }) {
  return (
    <Button
      type="submit"
      className={incomplete ? "bg-border text-ink-3 hover:bg-border" : ""}
      aria-disabled={incomplete || undefined}
      disabled={pending}
      aria-busy={pending}
    >
      {pending && <Spinner />}
      {pending ? busyLabel : children}
    </Button>
  );
}

function SwitchLine({ question, to, label }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-ink-3">
      {question}
      <Link to={to} className="flex min-h-11 items-center font-bold text-primary">
        {label}
      </Link>
    </p>
  );
}

// Google returns to /login with ?error=… when the user cancels or the provider refuses.
const googleError = () =>
  new URLSearchParams(window.location.search).has("error")
    ? "Masuk dengan Google dibatalkan atau gagal. Coba lagi."
    : "";

// Shown only while the auth server has Google switched on. Mock signs in at once; Supabase leaves for Google and
// comes back to /login with a code.
function GoogleSignIn({ onError }) {
  const { refresh } = useSession();
  const [shown, setShown] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    api.auth.providers().then((p) => alive && setShown(p.google));
    return () => {
      alive = false;
    };
  }, []);
  if (!shown) return null;

  const google = async () => {
    setPending(true);
    onError("");
    try {
      await api.auth.signInWithGoogle();
      await refresh();
    } catch (e) {
      onError(e.message);
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="neutral"
        onClick={google}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <Spinner /> : <FcGoogle className="size-5" aria-hidden />}
        Lanjut dengan Google
      </Button>
      <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden />
        atau pakai email
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
    </>
  );
}

// The two agreements (registration and /welcome), each with its text one tap away.
function ConsentFields({ form }) {
  const [legal, setLegal] = useState(null);
  return (
    <>
      {[
        ["acceptTerms", "terms"],
        ["acceptPrivacy", "privacy"],
      ].map(([field, doc]) => (
        <div
          key={field}
          className="flex flex-col gap-1 [&_label]:-my-[11px] [&_label]:min-h-0 [&_label]:py-[11px]"
        >
          <CheckboxField
            label={`Saya setuju dengan ${LEGAL[doc].title} RuangKPR.`}
            checked={form.values[field]}
            onChange={(v) => form.set(field, v)}
            error={form.error(field)}
            name={field}
          />
          <button
            type="button"
            onClick={() => setLegal(doc)}
            className="ml-[34px] w-fit text-[13px] font-bold text-primary hover:underline"
          >
            Baca {LEGAL[doc].title}
          </button>
        </div>
      ))}
      <FormDialog
        open={!!legal}
        onOpenChange={(o) => !o && setLegal(null)}
        title={legal ? LEGAL[legal].title : ""}
      >
        <p className="text-sm leading-[22px] text-ink-3">
          {legal && LEGAL[legal].body}
        </p>
      </FormDialog>
    </>
  );
}

const EMPTY_CODE = ["", "", "", "", "", ""];

// Six boxes: typing moves on, Backspace on an empty box moves back, a pasted code fills them all.
function CodeInput({ digits, onChange, error }) {
  const refs = useRef([]);
  const focusAt = (i) => refs.current[Math.max(0, Math.min(5, i))]?.focus();
  // A rejected code empties the boxes: start again at the first one.
  useEffect(() => {
    if (error) refs.current[0]?.focus();
  }, [error]);

  const fill = (text) => {
    const d = text.replace(/\D/g, "").slice(0, 6).split("");
    onChange([...d, ...Array(6 - d.length).fill("")]);
    focusAt(d.length);
  };
  const onInput = (i, value) => {
    const d = value.replace(/\D/g, "");
    if (d.length > 1) return fill(d);
    onChange(digits.map((x, j) => (j === i ? d : x)));
    if (d && i < 5) focusAt(i + 1);
  };

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="sr-only">Kode verifikasi 6 digit</legend>
      <div className="flex gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            value={d}
            onChange={(e) => onInput(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) focusAt(i - 1);
            }}
            onPaste={(e) => {
              e.preventDefault();
              fill(e.clipboardData.getData("text"));
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={6}
            aria-label={`Digit ${i + 1} dari 6`}
            aria-invalid={error ? "true" : undefined}
            className={`h-[60px] w-full max-w-[60px] min-w-0 flex-1 rounded-lg border bg-field text-center text-[22px] font-bold outline-none focus:border-primary focus:ring-3 focus:ring-ring/15 ${error ? "border-brand-red" : d ? "border-primary" : "border-input"}`}
          />
        ))}
      </div>
      {error && (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-[13px] font-semibold text-danger"
        >
          <CircleAlertIcon className="size-4" aria-hidden />
          {error}
        </span>
      )}
      {isMock && (
        <span className="text-xs text-muted-foreground">
          Mode demo: gunakan kode 148260 (000000 = salah, 999999 =
          kedaluwarsa).
        </span>
      )}
    </fieldset>
  );
}

const isCodeError = (e) => ["OTP_INVALID", "OTP_EXPIRED"].includes(e.code);

// `send` sends again (the code, or the reset link) and answers with the next resendAvailableAt.
function ResendCode({ initialAt, question, send, sentMessage, onResent, onError }) {
  const [resendAt, setResendAt] = useState(initialAt ?? 0);
  const wait = useCountdown(resendAt);
  const resend = async () => {
    if (wait > 0) return;
    try {
      const r = await send();
      setResendAt(r.resendAvailableAt);
      onResent?.();
      toast(sentMessage);
    } catch (e) {
      onError(e.message);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-ink-3">
      <span>{question}</span>
      <button
        type="button"
        onClick={resend}
        aria-disabled={wait > 0}
        className={`min-h-11 font-bold ${wait > 0 ? "cursor-not-allowed text-muted-foreground" : "text-primary"}`}
      >
        {wait > 0
          ? `Kirim Ulang (${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")})`
          : "Kirim Ulang"}
      </button>
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [apiError, setApiError] = useState(googleError);
  const [pending, setPending] = useState(false);
  const form = useForm({ email: "", password: "" }, validateLogin);

  const onSubmit = form.submit(async (v) => {
    setPending(true);
    setApiError("");
    try {
      await api.auth.signInWithPassword(v);
      await refresh();
    } catch (e) {
      // Registered but never verified: a fresh code is on its way.
      if (e.code === "EMAIL_NOT_CONFIRMED") {
        toast(e.message);
        await refresh();
        navigate("/verify");
        return;
      }
      setApiError(e.message);
    } finally {
      setPending(false);
    }
  });

  return (
    <AuthLayout>
      <AuthHeading title="Masuk">
        Masuk ke akun RuangKPR kamu untuk melanjutkan.
      </AuthHeading>
      <GoogleSignIn onError={setApiError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          placeholder="nama@email.com"
          autoComplete="email"
          {...form.bind("email")}
        />
        <div className="flex flex-col">
          <PasswordField
            label="Password"
            autoComplete="current-password"
            {...form.bind("password")}
          />
          <Link
            to="/forgot-password"
            className="ml-auto flex min-h-11 items-center text-[13px] font-bold text-primary"
          >
            Lupa password?
          </Link>
        </div>
        {isMock && (
          <span className="-mt-2 text-xs text-muted-foreground">
            Mode demo: akun contoh memakai password {DEMO_PASSWORD}.
          </span>
        )}
        {apiError && <FormAlert>{apiError}</FormAlert>}
        <SubmitButton
          incomplete={form.hasErrors}
          pending={pending}
          busyLabel="Masuk…"
        >
          Masuk
        </SubmitButton>
      </form>
      <SwitchLine question="Belum punya akun?" to="/register" label="Daftar" />
    </AuthLayout>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useSession();
  const [apiError, setApiError] = useState("");
  const [pending, setPending] = useState(false);
  const form = useForm(
    { name: "", email: "", password: "", confirm: "", acceptTerms: false, acceptPrivacy: false },
    validateRegister,
  );

  const onSubmit = form.submit(async (v) => {
    setPending(true);
    setApiError("");
    try {
      await api.auth.signUp(v);
      await refresh();
      navigate("/verify");
    } catch (e) {
      setApiError(e.message);
    } finally {
      setPending(false);
    }
  });

  return (
    <AuthLayout>
      <AuthHeading title="Buat akun">
        Gratis. Rencanakan, ajukan, dan pantau KPR kamu di satu tempat.
      </AuthHeading>
      <GoogleSignIn onError={setApiError} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
        <TextField
          label="Nama Lengkap"
          placeholder="Firdi Audi"
          autoComplete="name"
          {...form.bind("name")}
        />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          placeholder="nama@email.com"
          hint="Kode verifikasi 6 digit dikirim ke email ini."
          autoComplete="email"
          {...form.bind("email")}
        />
        <PasswordField
          label="Password"
          hint={PASSWORD_HINT}
          autoComplete="new-password"
          {...form.bind("password")}
        />
        <PasswordField
          label="Ulangi password"
          autoComplete="new-password"
          {...form.bind("confirm")}
        />
        <ConsentFields form={form} />
        {apiError && <FormAlert>{apiError}</FormAlert>}
        <SubmitButton
          incomplete={form.hasErrors}
          pending={pending}
          busyLabel="Mendaftarkan…"
        >
          Daftar
        </SubmitButton>
      </form>
      <SwitchLine question="Sudah punya akun?" to="/login" label="Masuk" />
    </AuthLayout>
  );
}

// The code that verifies a new account's email (from /register, or from /login for one never verified).
export function VerifyPage() {
  const { session, refresh } = useSession();
  const [digits, setDigits] = useState(EMPTY_CODE);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const code = digits.join("");

  const verify = async (e) => {
    e.preventDefault();
    if (code.length < 6 || pending) return;
    setPending(true);
    try {
      await api.auth.verifySignup({ token: code });
      toast.success("Email terverifikasi. Selamat datang di RuangKPR!");
      await refresh();
    } catch (err) {
      setError(err.message);
      setExpired(err.code === "OTP_EXPIRED");
      if (isCodeError(err)) setDigits(EMPTY_CODE);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout>
      <BackLink to="/register">Ubah email</BackLink>
      <AuthHeading badge="Verifikasi Email" title="Masukkan kode">
        Kode 6 digit sudah dikirim ke{" "}
        <b className="text-foreground">
          {session.verification?.maskedDestination}
        </b>
        .
      </AuthHeading>
      <form onSubmit={verify} className="flex flex-col gap-6">
        <CodeInput
          digits={digits}
          onChange={(d) => {
            setDigits(d);
            setError("");
          }}
          error={error}
        />
        <Button
          type="submit"
          disabled={code.length < 6 || pending}
          aria-busy={pending}
        >
          {pending && <Spinner />}
          {pending ? "Memverifikasi…" : "Verifikasi"}
        </Button>
        <ResendCode
          initialAt={session.verification?.resendAvailableAt}
          question={expired ? "Kode kedaluwarsa?" : "Belum terima kode?"}
          send={api.auth.resendOtp}
          sentMessage="Kode baru sudah dikirim."
          onResent={() => {
            setError("");
            setExpired(false);
          }}
          onError={setError}
        />
      </form>
    </AuthLayout>
  );
}

// Step 1 asks for the email; step 2 says a link is on its way (the same words whether or not the email has an account).
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { refresh } = useSession();
  const [sent, setSent] = useState(null);
  const [apiError, setApiError] = useState("");
  const [pending, setPending] = useState(false);
  const form = useForm({ email: state?.email ?? "" }, validateEmail);

  const onSubmit = form.submit(async (v) => {
    setPending(true);
    setApiError("");
    try {
      setSent(await api.auth.requestPasswordReset(v));
    } catch (e) {
      setApiError(e.message);
    } finally {
      setPending(false);
    }
  });

  // Mock only: stands in for opening the emailed link.
  const openDemoLink = async () => {
    try {
      await api.auth.openResetLink();
      await refresh();
      navigate("/reset-password");
    } catch (e) {
      setApiError(e.message);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <button
          type="button"
          onClick={() => setSent(null)}
          className="flex min-h-11 w-fit items-center gap-1.5 text-[13px] font-bold text-primary"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Ubah email
        </button>
        <AuthHeading badge="Lupa Password" title="Cek email kamu">
          Kalau <b className="text-foreground">{sent.maskedDestination}</b>{" "}
          terdaftar, kami sudah mengirim link untuk membuat password baru.
          Buka link itu di browser ini. Link hanya bisa dipakai sekali dan
          berlaku sebentar.
        </AuthHeading>
        {isMock && (
          <Button type="button" variant="neutral" onClick={openDemoLink}>
            Buka link reset (mode demo)
          </Button>
        )}
        {apiError && <FormAlert>{apiError}</FormAlert>}
        <ResendCode
          initialAt={sent.resendAvailableAt}
          question="Belum terima email?"
          send={() => api.auth.requestPasswordReset(form.values)}
          sentMessage="Link baru sudah dikirim."
          onError={setApiError}
        />
        <SwitchLine question="Sudah ingat password?" to="/login" label="Masuk" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <BackLink to="/login">Kembali ke Masuk</BackLink>
      <AuthHeading title="Lupa password">
        Masukkan email akun kamu. Kami kirim link untuk membuat password baru.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          placeholder="nama@email.com"
          autoComplete="email"
          {...form.bind("email")}
        />
        {apiError && <FormAlert>{apiError}</FormAlert>}
        <SubmitButton
          incomplete={form.hasErrors}
          pending={pending}
          busyLabel="Mengirim link…"
        >
          Kirim link reset
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}

// Where the emailed link lands, already signed in (session status 'recovery'): only the new password is asked. Without
// that session the link failed: used before, expired, or opened in another browser.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { session, refresh, logout } = useSession();
  const [apiError, setApiError] = useState("");
  const [pending, setPending] = useState(false);
  const form = useForm({ password: "", confirm: "" }, validateNewPassword);

  const onSubmit = form.submit(async (v) => {
    setPending(true);
    setApiError("");
    try {
      await api.auth.updatePassword(v);
      toast.success("Password baru tersimpan.");
      await refresh();
    } catch (e) {
      setApiError(e.message);
      setPending(false);
    }
  });

  const cancel = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (session.status !== "recovery") {
    return (
      <AuthLayout>
        <AuthHeading badge="Reset Password" title="Link tidak bisa dipakai">
          Link reset password sudah pernah dibuka, sudah kedaluwarsa, atau
          dibuka di browser lain. Minta link baru, lalu buka di browser yang
          sama.
        </AuthHeading>
        <Button type="button" onClick={() => navigate("/forgot-password")}>
          Minta link baru
        </Button>
        <SwitchLine question="Sudah ingat password?" to="/login" label="Masuk" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading badge="Reset Password" title="Buat password baru">
        Untuk akun <b className="text-foreground">{session.user?.contact}</b>.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
        <PasswordField
          label="Password baru"
          hint={PASSWORD_HINT}
          autoComplete="new-password"
          {...form.bind("password")}
        />
        <PasswordField
          label="Ulangi password baru"
          autoComplete="new-password"
          {...form.bind("confirm")}
        />
        {apiError && <FormAlert>{apiError}</FormAlert>}
        <div className="flex flex-col gap-2.5">
          <SubmitButton
            incomplete={form.hasErrors}
            pending={pending}
            busyLabel="Menyimpan…"
          >
            Simpan password baru
          </SubmitButton>
          <button
            type="button"
            onClick={cancel}
            className="min-h-11 text-[13px] font-bold text-primary"
          >
            Batal dan keluar
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

// First Google sign-in (or a new S&K version): name + consent before any data (spec 2026-10-09 §3.1).
export function WelcomePage() {
  const { session, refresh, logout } = useSession();
  const [apiError, setApiError] = useState("");
  const [pending, setPending] = useState(false);
  const form = useForm(
    { name: session.user?.name ?? "", acceptTerms: false, acceptPrivacy: false },
    validateWelcome,
  );

  const onSubmit = form.submit(async (v) => {
    setPending(true);
    setApiError("");
    try {
      await api.auth.acceptConsents({
        name: v.name.trim(),
        acceptTerms: v.acceptTerms,
        acceptPrivacy: v.acceptPrivacy,
      });
      toast.success("Selamat datang di RuangKPR!");
      await refresh();
    } catch (e) {
      setApiError(e.message);
    } finally {
      setPending(false);
    }
  });

  return (
    <AuthLayout>
      <AuthHeading badge="Akun baru" title="Satu langkah lagi">
        Masuk sebagai{" "}
        <b className="text-foreground">{session.user?.contact}</b>. Lengkapi
        nama dan setujui ketentuan untuk mulai.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
        <TextField
          label="Nama Lengkap"
          placeholder="Firdi Audi"
          autoComplete="name"
          {...form.bind("name")}
        />
        <ConsentFields form={form} />
        {apiError && <FormAlert>{apiError}</FormAlert>}
        <div className="flex flex-col gap-2.5">
          <SubmitButton
            incomplete={form.hasErrors}
            pending={pending}
            busyLabel="Menyimpan…"
          >
            Mulai pakai RuangKPR
          </SubmitButton>
          <button
            type="button"
            onClick={logout}
            className="min-h-11 text-[13px] font-bold text-primary"
          >
            Bukan akun kamu? Keluar
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

// One page for users (/profile/password) and staff (/admin/password), inside their own layout.
export function ChangePasswordPage({ admin = false }) {
  const navigate = useNavigate();
  const { session } = useSession();
  const [apiError, setApiError] = useState("");
  const [pending, setPending] = useState(false);
  const form = useForm(
    { currentPassword: "", password: "", confirm: "" },
    validateChangePassword,
  );
  const back = admin ? "/admin" : "/profile";
  const Header = admin ? AdminHeader : PageHeader;

  const onSubmit = form.submit(async (v) => {
    setPending(true);
    setApiError("");
    try {
      await api.auth.changePassword(v);
      toast.success("Password berhasil diubah.");
      navigate(back);
    } catch (e) {
      setApiError(e.message);
      setPending(false);
    }
  });

  // No current password to type (forgotten, or an account made with Google): the reset link, to the same email.
  const reset = async () => {
    setApiError("");
    try {
      await api.auth.requestPasswordReset({ email: session.user.contact });
      toast.success(`Link reset password dikirim ke ${session.user.contact}. Buka di browser ini.`);
    } catch (e) {
      setApiError(e.message);
    }
  };

  return (
    <>
      <Header title="Ubah password" subtitle={session.user.contact} back={back} />
      <Panel className="max-w-[560px] sm:p-7">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-[18px]">
          <PasswordField
            label="Password lama"
            autoComplete="current-password"
            {...form.bind("currentPassword")}
          />
          <PasswordField
            label="Password baru"
            hint={PASSWORD_HINT}
            autoComplete="new-password"
            {...form.bind("password")}
          />
          <PasswordField
            label="Ulangi password baru"
            autoComplete="new-password"
            {...form.bind("confirm")}
          />
          {apiError && <FormAlert>{apiError}</FormAlert>}
          <SubmitButton
            incomplete={form.hasErrors}
            pending={pending}
            busyLabel="Menyimpan…"
          >
            Simpan password
          </SubmitButton>
          <button
            type="button"
            onClick={reset}
            className="min-h-11 text-[13px] font-bold text-primary"
          >
            Lupa password lama? Kirim link reset ke email
          </button>
        </form>
      </Panel>
    </>
  );
}
