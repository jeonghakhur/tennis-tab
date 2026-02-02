import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function addSkillLevels() {
  const newValues = [
    '1_YEAR',
    '2_YEARS',
    '3_YEARS',
    '4_YEARS',
    '5_YEARS',
    '6_YEARS',
    '7_YEARS',
    '8_YEARS',
    '9_YEARS',
    '10_PLUS_YEARS'
  ]

  console.log('Adding new skill_level enum values...')

  for (const value of newValues) {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TYPE skill_level ADD VALUE IF NOT EXISTS '${value}'`
    })

    if (error) {
      console.log(`Note: ${value} - ${error.message}`)
    } else {
      console.log(`Added: ${value}`)
    }
  }

  console.log('Done!')
}

addSkillLevels()
