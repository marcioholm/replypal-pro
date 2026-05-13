
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xvvgjeccncfylvvbjgwj.supabase.co';
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2dmdqZWNjbmNmeWx2dmJqZ3dqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgzMjg1NSwiZXhwIjoyMDkyNDA4ODU1fQ.NC7z98kDz7H218kOSNVnOs_X2LTmrO8QItPtKGvLiiY';

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function checkLogs() {
  const { data, error } = await supabase
    .from('relatorios_envios_logs')
    .select('*')
    .order('enviado_em', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  console.log('Last 10 logs:');
  console.log(JSON.stringify(data, null, 2));
}

checkLogs();
