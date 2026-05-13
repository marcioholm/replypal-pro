
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xvvgjeccncfylvvbjgwj.supabase.co';
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2dmdqZWNjbmNmeWx2dmJqZ3dqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjgzMjg1NSwiZXhwIjoyMDkyNDA4ODU1fQ.NC7z98kDz7H218kOSNVnOs_X2LTmrO8QItPtKGvLiiY';

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function checkSLA() {
  // Check table structure
  const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'conversas' });
  if (colError) {
    // If RPC fails, try a direct query to information_schema if possible
    console.log('RPC get_table_columns failed, trying raw query...');
  } else {
    console.log('Columns:', cols);
  }

  // Check recent records to see the typical gap between created_at and sla_deadline
  const { data: records, error: recError } = await supabase
    .from('conversas')
    .select('created_at, sla_deadline, status')
    .not('sla_deadline', 'is', null)
    .limit(5);

  if (recError) {
    console.error('Error fetching records:', recError);
  } else {
    console.log('Recent Conversas SLA data:');
    records.forEach(r => {
      const created = new Date(r.created_at);
      const deadline = new Date(r.sla_deadline);
      const diffMs = deadline.getTime() - created.getTime();
      const diffMins = Math.round(diffMs / (1000 * 60));
      console.log(`Created: ${r.created_at} | Deadline: ${r.sla_deadline} | Diff: ${diffMins} mins | Status: ${r.status}`);
    });
  }
}

checkSLA();
