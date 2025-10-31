import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, contactPerson, role, emailType } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt = "";
    if (emailType === "introduction") {
      systemPrompt = `You are a professional executive recruiter for a global mining corporation. Generate a professional, personalized email introduction to ${contactPerson} at ${companyName} about a ${role} opportunity. The email should be concise (150-200 words), professional, and highlight the strategic importance of the role in the mining industry. Include a clear call to action for a brief call.`;
    } else if (emailType === "followup") {
      systemPrompt = `You are a professional executive recruiter. Generate a polite follow-up email to ${contactPerson} at ${companyName} regarding the ${role} opportunity you previously discussed. The email should be brief (100-150 words), reference the previous conversation, and suggest specific times for a follow-up discussion.`;
    }

    console.log('Generating email with AI...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate the email content now.` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const emailContent = data.choices[0].message.content;

    console.log('Email generated successfully');
    return new Response(JSON.stringify({ emailContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-email function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
