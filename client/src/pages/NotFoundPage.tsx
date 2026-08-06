import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Pagina no encontrada"
      description="La ruta solicitada no existe dentro de Zorzal Lirio OS."
      action={
        <Link to="/dashboard">
          <Button variant="secondary">Volver al dashboard</Button>
        </Link>
      }
    />
  );
}
