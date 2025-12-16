import { redirect } from 'next/navigation';

export default function NewEventRedirectPage() {
  redirect('/admin/events/new');
}

