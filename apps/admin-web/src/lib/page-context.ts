import { getActiveMembership, requireUser } from "@/lib/auth";
import { getDictionary, isLocale } from "@/lib/i18n";

export async function getTenantPageContext(rawLocale: string) {
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const dictionary = getDictionary(locale);
  const { supabase, user } = await requireUser(locale);
  const membership = await getActiveMembership(user.id);
  return { locale, dictionary, supabase, user, membership };
}
