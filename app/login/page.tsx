import LoginClient from './LoginClient'

type LoginPageProps = {
  searchParams: Promise<{
    next?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  return <LoginClient next={params.next ?? null} />
}
