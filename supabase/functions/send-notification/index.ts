import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const { record, old_record, table, type } = await req.json()

    // 1. Fetch all admin emails from app_users
    const { data: admins, error: adminError } = await supabase
      .from('app_users')
      .select('email')
      .eq('role', 'admin')

    if (adminError || !admins || admins.length === 0) {
      console.error("Error fetching admins or no admins found:", adminError)
      return new Response(JSON.stringify({ message: "No admins found to notify." }), { status: 200 })
    }

    const adminEmails = admins.map(a => a.email).filter(Boolean)

    let subject = ""
    let html = ""
    let recipientEmails: string[] = []

    if (table === 'app_users' && type === 'INSERT') {
      subject = "New User Registration - Action Required"
      html = `
        <h1>New User Verification Request</h1>
        <p>A new user has signed up and is waiting for verification:</p>
        <ul>
          <li><strong>Name:</strong> ${record.full_name}</li>
          <li><strong>Email:</strong> ${record.email}</li>
          <li><strong>Mobile:</strong> ${record.mobile_number}</li>
        </ul>
        <p>Please log in to the admin portal to review their ID card and approve/decline their account.</p>
      `
      recipientEmails = adminEmails
    } else if (table === 'schedules' && type === 'INSERT') {
      subject = "New Site Tripping Request"
      html = `
        <h1>New Schedule Request</h1>
        <p>A new site tripping request has been submitted:</p>
        <ul>
          <li><strong>Client:</strong> ${record.client_name}</li>
          <li><strong>Platform:</strong> ${record.platform}</li>
          <li><strong>Date:</strong> ${record.schedule_date}</li>
          <li><strong>Time:</strong> ${record.schedule_time}</li>
        </ul>
        <p>Please log in to the admin portal to approve or decline this request.</p>
      `
      recipientEmails = adminEmails
    } else if (table === 'app_users' && type === 'UPDATE') {
      const oldStatus = old_record?.verification_status
      const newStatus = record.verification_status

      if (oldStatus !== 'verified' && newStatus === 'verified') {
        subject = "Welcome to VHBC! Your Account is Verified"
        html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e5f2; border-radius: 12px;">
            <h2 style="color: #001bb7; margin-bottom: 20px;">Congratulations, ${record.full_name}!</h2>
            <p>We are excited to inform you that your VHBC Referrer account has been successfully approved and verified.</p>
            <p>You can now access your referrer dashboard to:</p>
            <ul style="padding-left: 20px;">
              <li>Submit new client referrals</li>
              <li>Schedule site tripping (Google Meet, Zoom, or In-person)</li>
              <li>Track the status of your sales and earnings</li>
            </ul>
            <p style="margin-top: 20px;">To get started, simply log in to your account.</p>
            <div style="margin: 30px 0; text-align: center; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
              <a href="https://vhbc-referrer-system.pages.dev" style="background-color: #001bb7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Dashboard</a>
              <a href="https://referral.vhbc.com.ph/gift-cheque" style="background-color: #ff8a5c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Check Registration Reward</a>
            </div>
            <p style="font-size: 0.9em; color: #666; border-top: 1px solid #e0e5f2; padding-top: 20px;">
              If you have any questions or need assistance, please feel free to reply to this email or contact support.
            </p>
          </div>
        `
        recipientEmails = [record.email]
      }
    }

    if (!subject || !html || recipientEmails.length === 0) {
      return new Response(JSON.stringify({ message: "No action taken for this payload." }), { status: 200 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'VHBC System <noreply@referrer.vhbc.com.ph>',
        to: recipientEmails,
        subject: subject,
        html: html,
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { status: res.status })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
