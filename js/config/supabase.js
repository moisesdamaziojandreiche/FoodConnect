import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL =
    'https://qhssnuzrvmrsnuzuiwdz.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_XP7PwbwclYA70bEPPKQ4-Q_nwGDgkAa';

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);