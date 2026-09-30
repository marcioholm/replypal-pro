
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupStorage() {
  console.log('Setting up Supabase Storage...')
  
  // 1. Create bucket if it doesn't exist
  const { data: bucket, error: bucketError } = await supabase.storage.createBucket('chat-media', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['image/*', 'audio/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  })

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log('Bucket "chat-media" already exists.')
    } else {
      console.error('Error creating bucket:', bucketError.message)
    }
  } else {
    console.log('Bucket "chat-media" created successfully.')
  }

  // 2. We don't strictly need RLS policies if we use service role for creation, 
  // but if users need to upload directly from frontend, we need them.
  // The app seems to use the anon key for upload in ChatPage.tsx.
  // So we MUST ensure public access for uploads if no auth.
  
  console.log('Storage setup complete.')
}

setupStorage()
