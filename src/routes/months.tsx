import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/months')({
  component: () => <Outlet />,
})
