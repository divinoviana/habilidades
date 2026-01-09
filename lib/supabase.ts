
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jonuyirnloracjxxuwxw.supabase.co';
const supabaseKey = 'sb_publishable_HXEhFQFfZen-1_7-Qs4bcA_fnudTOCO';

export const supabase = createClient(supabaseUrl, supabaseKey);
