import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import nodemailer from 'nodemailer';
import { logActivity } from '@/lib/logger';

const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, 
    requireTLS: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

function migrateData(data: any) {
    if (!data || !data.draft) {
        data = {
            draft: { en: data, es: data },
            published: { en: data, es: data }
        };
    }
    ['en', 'es'].forEach(lang => {
        if (!data.draft[lang]) data.draft[lang] = {};
        if (!data.published[lang]) data.published[lang] = {};
        if (!data.draft[lang].responses) data.draft[lang].responses = {};
        if (!data.published[lang].responses) data.published[lang].responses = {};
    });
    return data;
}

// CORS Helper for Next.js App Router API
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request, props: { params: Promise<{ formId: string }> }) {
    try {
        const payload = await request.json();
        const { formId } = await props.params;
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        const lang = searchParams.get('lang') || 'en';

        if (!key) {
            return NextResponse.json({ success: false, message: 'Missing public form key.' }, { status: 400, headers: corsHeaders });
        }

        const { data: existingData, error: fetchErr } = await supabase
            .from('cms_data')
            .select('data, user_id')
            .eq('data->draft->en->brand->>formKey', key)
            .single();

        if (fetchErr || !existingData) {
            return NextResponse.json({ success: false, message: 'Invalid form key or account not found.' }, { status: 404, headers: corsHeaders });
        }
        
        const userId = existingData.user_id;

        let matrix = migrateData(existingData.data);

        if (!matrix.published[lang].responses[formId]) {
            matrix.published[lang].responses[formId] = [];
        }
        if (!matrix.draft[lang].responses[formId]) {
            matrix.draft[lang].responses[formId] = [];
        }

        const newResponse = {
            id: 'resp_' + Date.now(),
            timestamp: new Date().toISOString(),
            data: payload
        };

        matrix.published[lang].responses[formId].unshift(newResponse);
        matrix.draft[lang].responses[formId] = matrix.published[lang].responses[formId];

        const { error: upsertErr } = await supabase
            .from('cms_data')
            .upsert({ user_id: userId, data: matrix }, { onConflict: 'user_id' });

        if (upsertErr) throw upsertErr;

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            const activeForm = matrix.published[lang].forms?.find((f: any) => f.id === formId) || { title: 'Custom Form' };
            
            // Build a modern, premium HTML email template
            let emailHtml = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid #eaeaea;">
                <div style="background-color: #121315; padding: 40px 30px; text-align: center;">
                    <h2 style="color: #d0aa69; margin: 0; font-size: 26px; font-weight: 500; letter-spacing: 1px;">New Form Submission</h2>
                    <p style="color: #a0a0a0; margin: 10px 0 0 0; font-size: 15px;">${activeForm.title}</p>
                </div>
                <div style="padding: 40px 30px;">
                    <p style="color: #555; font-size: 14px; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; text-align: center;">
                        Received on <strong style="color: #222;">${new Date(newResponse.timestamp).toLocaleString()}</strong>
                    </p>
                    <table style="width: 100%; border-collapse: collapse;">
            `;
            
            for (const [key, value] of Object.entries(payload)) {
                emailHtml += `
                        <tr>
                            <td style="padding: 16px 0; border-bottom: 1px solid #f0f0f0; width: 35%; vertical-align: top;">
                                <span style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">${key}</span>
                            </td>
                            <td style="padding: 16px 0; border-bottom: 1px solid #f0f0f0; color: #111; font-size: 15px; vertical-align: top; font-weight: 500;">
                                ${value as string}
                            </td>
                        </tr>
                `;
            }

            emailHtml += `
                    </table>
                </div>
                <div style="background-color: #fcfcfc; padding: 25px; text-align: center; border-top: 1px solid #eee;">
                    <p style="margin: 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Powered by Arcova System</p>
                </div>
            </div>
            `;

            // Find the customer's email in the payload
            let customerEmail = '';
            for (const key of Object.keys(payload)) {
                if (key.toLowerCase().includes('email')) {
                    customerEmail = payload[key] as string;
                    break;
                }
            }

            const mailPromises = [];

            const tenantEmail = matrix.published[lang].brand?.adminEmail || process.env.SMTP_USER;

            // 1. Dispatch the Internal Admin Alert
            mailPromises.push(emailTransporter.sendMail({
                from: `"Operations Hub" <${process.env.SMTP_USER}>`,
                to: tenantEmail,
                replyTo: customerEmail || undefined, // Directs replies to the customer
                subject: `New Lead: ${activeForm.title}`,
                html: emailHtml
            }));

            // 2. Dispatch the External Customer Auto-Responder (If an email was provided)
            if (customerEmail) {
                const autoResponderHtml = `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid #eaeaea;">
                    <div style="background-color: #121315; padding: 40px 30px; text-align: center;">
                        <h2 style="color: #d0aa69; margin: 0; font-size: 26px; font-weight: 500; letter-spacing: 1px;">Registration Received</h2>
                        <p style="color: #a0a0a0; margin: 10px 0 0 0; font-size: 15px;">${activeForm.title}</p>
                    </div>
                    <div style="padding: 40px 30px; color: #444; font-size: 16px; line-height: 1.6;">
                        <p>Hi there,</p>
                        <p>Thank you so much for registering! We have successfully received your submission.</p>
                        <p><strong>Important Details:</strong></p>
                        <ul style="color: #555;">
                            <li><strong>Venue:</strong> To be announced prior to the event date.</li>
                            <li><strong>Updates:</strong> We will communicate any schedule changes or results directly via this email thread.</li>
                        </ul>
                        <p>If you have any immediate questions, simply reply to this email to get in touch with our team.</p>
                        <br>
                        <p>Best regards,<br><strong>Tournament Operations Team</strong></p>
                    </div>
                </div>
                `;

                mailPromises.push(emailTransporter.sendMail({
                    from: `"Tournament Support" <${process.env.SMTP_USER}>`,
                    to: customerEmail,
                    replyTo: tenantEmail, // Directs replies back to the Admin
                    subject: `Registration Confirmation: ${activeForm.title}`,
                    html: autoResponderHtml
                }));
            }

            // Execute both emails concurrently
            Promise.all(mailPromises).then(() => {
                logActivity(userId, `EMAIL_NOTIFICATION_SENT_${formId}`, 'SUCCESS');
            }).catch(err => {
                console.error('Email Dispatch Error:', err);
                logActivity(userId, `EMAIL_NOTIFICATION_FAILED_${formId}`, 'FAILED');
            });
        }
        
        logActivity(userId, `FORM_SUBMISSION_${formId}`, 'SUCCESS');
        return NextResponse.json({ success: true, message: 'Response recorded securely.' }, { headers: corsHeaders });
    } catch (err) {
        console.error('Submit Form Error:', err);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
    }
}
