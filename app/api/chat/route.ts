import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are the Consensus AI Assistant — a professional M&A (Mergers & Acquisitions) deal analyst embedded in the Consensus platform.

## Your Role
You help investors, business brokers, and M&A consultants understand business acquisition opportunities. You answer questions about deals using ONLY the deal data provided to you as context.

## Rules
1. **Be professional and concise.** Give clear, data-driven answers based on the deal details provided.
2. **Stay on topic.** Only discuss topics related to the deal, business acquisitions, M&A, finance, and investment strategy.
3. **Use the deal data.** When the user asks about financials, description, location, industry, contacts, etc., reference the specific numbers and facts from the deal context.
4. **Format your answers well.** Use markdown: bullet points, bold text, and headers where helpful.
5. **Be honest.** If the deal data doesn't contain certain information, say so — don't make things up.
6. **Handle inappropriate or off-topic questions.** If the user asks anything inappropriate, offensive, vulgar, sexual, or completely unrelated to business/finance/deals, respond ONLY with: "baag bosdina property levi hoi to le"
7. **Greet professionally.** If the user says hello or greets you, respond warmly and briefly summarize the deal you're looking at.`;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { message, dealContext, conversationHistory } = body;

        if (!message) {
            return NextResponse.json({ reply: 'Please provide a message.' }, { status: 400 });
        }

        // Build the deal context string
        let dealInfo = '';
        if (dealContext) {
            dealInfo = `
## Current Deal Context
- **Title:** ${dealContext.title || 'N/A'}
- **Industry:** ${dealContext.industry || 'N/A'}
- **Source:** ${dealContext.source || 'N/A'}
- **Location:** ${dealContext.city || 'N/A'}, ${dealContext.state || 'N/A'}, ${dealContext.country || 'N/A'}
- **Asking Price:** ${dealContext.price || 'N/A'}
- **Gross Revenue:** ${dealContext.gross_revenue || 'N/A'}
- **EBITDA:** ${dealContext.ebitda || 'N/A'}
- **Cash Flow:** ${dealContext.cash_flow || 'N/A'}
- **Inventory:** ${dealContext.inventory || 'N/A'}
- **Listed By Firm:** ${dealContext.listed_by_firm || 'N/A'}
- **Listed By Name:** ${dealContext.listed_by_name || 'N/A'}
- **Email:** ${dealContext.email || 'N/A'}
- **Phone:** ${dealContext.phone || 'N/A'}
- **Deal Date:** ${dealContext.deal_date || 'N/A'}
- **Source Link:** ${dealContext.source_link || 'N/A'}
- **Extra Information:** ${dealContext.extra_information || 'N/A'}

### Deal Description
${dealContext.description || 'No description available.'}
`;
        }

        // Build messages array
        const messages: OpenAI.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: SYSTEM_PROMPT + (dealInfo ? '\n\n' + dealInfo : ''),
            },
        ];

        // Add conversation history for multi-turn context
        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory) {
                messages.push({
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content,
                });
            }
        }

        // Add the current user message
        messages.push({ role: 'user', content: message });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 1024,
        });

        const reply = completion.choices[0]?.message?.content || 'I could not generate a response. Please try again.';

        return NextResponse.json({ reply });
    } catch (error: unknown) {
        console.error('Chat API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { reply: 'Sorry, something went wrong. Please try again later.', error: errorMessage },
            { status: 500 }
        );
    }
}
