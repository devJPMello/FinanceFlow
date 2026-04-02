export default function MissingClerkKey() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-8 text-center text-gray-700">
      <div className="max-w-lg space-y-3">
        <p className="font-semibold text-gray-900">Chave do Clerk inválida ou em falta</p>
        <p>
          Cola a <strong>Publishable key</strong> real no{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">frontend/.env</code>:
        </p>
        <code className="block text-left text-sm bg-gray-100 p-3 rounded-lg break-all">
          VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
        </code>
        <p className="text-sm text-gray-600">
          Clerk Dashboard → Configure → API Keys. Depois reinicia o{' '}
          <code className="bg-gray-100 px-1 rounded">npm run dev</code> (o Vite só lê o .env ao
          arrancar).
        </p>
      </div>
    </div>
  );
}
