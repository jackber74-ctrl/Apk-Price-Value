import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <span>© {new Date().getFullYear()} Apk Price Value</span>
        <span>
          <Link href="/terminos">Términos y condiciones</Link> · <Link href="/privacidad">Política de privacidad</Link>
        </span>
      </div>
    </footer>
  );
}
