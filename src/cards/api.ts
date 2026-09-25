import { supabase } from '../lib/supabase';

export type Card = { id: string; title: string; created_at: string };
export const PAGE_SIZE = 50;

export async function listCards(userId: string, offset = 0): Promise<Card[]> {
  const { data, error } = await supabase!.from('qm_cards')
    .select('id,title,created_at').eq('user_id', userId)
    .eq('status', 'unresolved').is('deleted_at', null)
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return data ?? [];
}

export async function addCard(userId: string, id: string, title: string): Promise<Card> {
  const value = title.trim();
  if (!value) throw new Error('タイトルを入力してください。');
  const { data, error } = await supabase!.from('qm_cards')
    .insert({ id, user_id: userId, title: value })
    .select('id,title,created_at').single();
  if (!error) return data;
  // A response can be lost after an insert succeeds. Reuse the attempt ID on retry.
  if (error.code === '23505') {
    const existing = await supabase!.from('qm_cards').select('id,title,created_at')
      .eq('id', id).eq('user_id', userId).single();
    if (!existing.error) return existing.data;
  }
  throw error;
}
