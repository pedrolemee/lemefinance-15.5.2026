import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation constants
const MAX_AMOUNT = 999999999;
const MAX_DESCRIPTION_LENGTH = 255;
const MAX_CATEGORY_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 500;
const MAX_INSTALLMENTS = 120;

// Sanitize text to remove potentially harmful characters
function sanitizeText(text: string, maxLength: number): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .slice(0, maxLength);
}

// Validate and sanitize parsed transaction data
function validateTransactionData(data: any): { valid: boolean; data?: any; error?: string } {
  // Validate amount
  if (typeof data.amount !== 'number' || isNaN(data.amount) || data.amount <= 0) {
    return { valid: false, error: 'Valor inválido' };
  }
  if (data.amount > MAX_AMOUNT) {
    return { valid: false, error: 'Valor muito alto para processamento' };
  }

  // Validate and sanitize description
  if (!data.description || typeof data.description !== 'string') {
    return { valid: false, error: 'Descrição inválida' };
  }
  const sanitizedDescription = sanitizeText(data.description, MAX_DESCRIPTION_LENGTH);
  if (sanitizedDescription.length === 0) {
    return { valid: false, error: 'Descrição inválida' };
  }

  // Validate type
  const validTypes = ['income', 'expense'];
  if (!data.type || !validTypes.includes(data.type)) {
    return { valid: false, error: 'Tipo de transação inválido' };
  }

  // Sanitize category if present
  let category = null;
  if (data.category && typeof data.category === 'string') {
    category = sanitizeText(data.category, MAX_CATEGORY_LENGTH) || null;
  }

  // Validate installments
  let installments = 1;
  if (data.installments) {
    const parsed = parseInt(String(data.installments), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= MAX_INSTALLMENTS) {
      installments = parsed;
    }
  }

  return {
    valid: true,
    data: {
      type: data.type,
      amount: Math.round(data.amount * 100) / 100, // Round to 2 decimal places
      description: sanitizedDescription,
      category,
      installments,
      // Date intentionally omitted: client fills with local today (avoids UTC off-by-one).
    }
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado - cabeçalho de autorização ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado - sessão inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message } = await req.json();
    
    // Validate message input
    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: "Message is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (typeof message !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Message must be a string" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, error: `Message must be less than ${MAX_MESSAGE_LENGTH} characters` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Sanitize input message
    const sanitizedMessage = sanitizeText(message, MAX_MESSAGE_LENGTH);
    if (sanitizedMessage.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Message is empty after sanitization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Parsing transaction from message for user:", user.id);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Extraia informações de transações financeiras. Responda APENAS com JSON válido:
{"type": "income" ou "expense", "amount": número, "description": "texto", "category": "opcional", "installments": número opcional}
Exemplos de DESPESAS: 
- "Gastei 50 no mercado" -> {"type": "expense", "amount": 50, "description": "Mercado"}
- "Comprei TV por 1200 em 12x" -> {"type": "expense", "amount": 1200, "description": "TV", "installments": 12}
- "Parcelei 600 em 3 vezes" -> {"type": "expense", "amount": 600, "description": "Compra", "installments": 3}
Exemplos de RECEITAS:
- "Recebi 2000 de salário" -> {"type": "income", "amount": 2000, "description": "Salário"}
- "Ganhei 500" -> {"type": "income", "amount": 500, "description": "Recebimento"}
- "Entrou 1500 de freelance" -> {"type": "income", "amount": 1500, "description": "Freelance"}`,
          },
          { role: "user", content: sanitizedMessage },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Limite de requisições excedido" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos insuficientes" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }
      console.error("AI API error:", aiResponse.status);
      throw new Error("Erro ao processar com IA");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanContent);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Não foi possível interpretar a mensagem" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422 }
      );
    }

    if (parsed.error) {
      return new Response(
        JSON.stringify({ success: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize AI-extracted data
    const validation = validateTransactionData(parsed);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 422 }
      );
    }

    console.log("Transaction parsed successfully for user:", user.id);

    // Return parsed transaction data without inserting
    // Frontend will handle insertion after payment method dialog for expenses
    return new Response(
      JSON.stringify({ 
        success: true, 
        transaction: validation.data
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ success: false, error: "Erro ao processar mensagem" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
