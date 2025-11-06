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
    const body = await req.json();
    const { action, companyName, company_name, contactPerson, role, emailType } = body;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Handle news generation
    if (action === 'get_news' && (companyName || company_name)) {
      const name = companyName || company_name;
      console.log(`Generating news for ${name}...`);
      
      const systemPrompt = `You are a news research assistant. Generate 3-5 recent, realistic news items about companies. Return ONLY a valid JSON array with objects containing these exact fields: id (string), title (string), date (YYYY-MM-DD format), source (string), summary (string). Make the news relevant and recent (within the last 6 months).`;

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
            { role: 'user', content: `Find recent news about ${name}. Return as JSON array only, no other text.` }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const newsText = data.choices[0].message.content.trim();
      
      // Try to extract JSON from the response
      let news;
      try {
        // Remove markdown code blocks if present
        const cleaned = newsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        news = JSON.parse(cleaned);
      } catch (e) {
        // If parsing fails, try to extract JSON array
        const jsonMatch = newsText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          news = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Failed to parse news JSON');
        }
      }

      // Ensure each news item has an id
      if (Array.isArray(news)) {
        news = news.map((item, index) => ({
          ...item,
          id: item.id || `news-${Date.now()}-${index}`,
        }));
      }

      console.log('News generated successfully');
      return new Response(JSON.stringify({ news }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle email generation (existing functionality)
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
