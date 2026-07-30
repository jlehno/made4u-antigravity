import { ManagementNotesClient } from '@/components/notes/ManagementNotesClient';

export const metadata = {
  title: 'Management Notes | Made4U Flow',
  description: 'Generate and manage operational notes, folder labels, and checklists in Made4U Flow.',
};

export default function ManagementNotesPage() {
  return <ManagementNotesClient />;
}
