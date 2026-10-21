import { useQuery } from '@tanstack/react-query';

import { nameLists, unreadMessages, type NameLists, type UnreadMessage } from '@/data/queries';
import { useDb } from '@/features/app/DbProvider';

export function useNameLists(): NameLists | undefined {
  const db = useDb();
  return useQuery({ queryKey: ['names'], queryFn: () => nameLists(db) }).data;
}

export function useUnreadMessages(): UnreadMessage[] | undefined {
  const db = useDb();
  return useQuery({ queryKey: ['unread'], queryFn: () => unreadMessages(db) }).data;
}
