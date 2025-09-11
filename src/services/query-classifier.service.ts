import { Injectable } from '@nestjs/common';
import { ChatGroq } from '@langchain/groq';
import { ConfigurationService } from '../config/configuration.service';

export type QueryType = 'personal' | 'employee' | 'policy' | 'mixed';

@Injectable()
export class QueryClassifierService {
  private llm: ChatGroq;

  constructor(private configService: ConfigurationService) {
    this.llm = new ChatGroq({
      model: this.configService.modelName,
      temperature: 0,
    });
  }

  private readonly personalKeywords = {
    english: [
      'my salary',
      'my position',
      'my department',
      'my benefits',
      'my leave',
      'my employment',
      'my contract',
      'my performance',
      'my manager',
      'my team',
      'my schedule',
      'my timesheet',
      'i work',
      'i am',
      'do i',
      'can i',
      'should i',
      'will i',
      'am i eligible',
      'my vacation',
      'my sick leave',
    ],
    mongolian: [
      'миний',
      'миний цалин',
      'миний албан тушаал',
      'миний хэлтэс',
      'миний амралт',
      'миний ажил',
      'миний гэрээ',
      'миний ажиллагаа',
      'би ажилладаг',
      'би хэн',
      'би юу',
      'намайг',
      'надад',
      'би чадах уу',
      'надад боломжтой юу',
      'миний амралт',
      'миний өвчтэй амралт',
    ],
  };

  private readonly employeeKeywords = {
    english: [
      'employee',
      'staff member',
      'worker',
      'colleague',
      'team member',
      'john',
      'smith',
      'who is',
      'who works',
      'find employee',
      'search employee',
      'employee information',
      'staff information',
      'person in',
      'works in',
      'manager of',
      'reports to',
      'contact for',
    ],
    mongolian: [
      'ажилтан',
      'ажилчин',
      'хамт олон',
      'багийн гишүүн',
      'хэн вэ',
      'хэн ажилладаг',
      'ажилтан хайх',
      'ажилтны мэдээлэл',
      'хүн',
      'ажилладаг',
      'менежер',
      'тайлагнадаг',
      'холбогдох хүн',
    ],
  };

  private readonly policyKeywords = {
    english: [
      'company policy',
      'procedure',
      'rules',
      'regulation',
      'process',
      'how to',
      'what is',
      'vacation policy',
      'sick leave policy',
      'benefits',
      'hiring',
      'onboarding',
      'performance review',
      'code of conduct',
      'dress code',
      'working hours',
      'remote work',
      'overtime',
      'training',
      'compliance',
    ],
    mongolian: [
      'журам',
      'дүрэм',
      'бодлого',
      'үйл ажиллагаа',
      'хэрхэн',
      'юу вэ',
      'амралтын журам',
      'өвчтэй амралтын журам',
      'тэтгэмж',
      'ажилд авах',
      'үнэлгээ',
      'ёс зүйн дүрэм',
      'хувцасны дүрэм',
      'ажлын цаг',
      'алсын ажил',
      'илүү цагийн ажил',
      'сургалт',
      'дагаж мөрдөх',
    ],
  };

  /**
   * Classifies a query into one of four types:
   */
  async classifyQuery(question: string): Promise<QueryType> {
    if (!question || question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }

    console.log('Classifying question with LLM:', question);

    try {
      const llmClassification = await this.classifyWithLLM(question);
      console.log(`📋 Query classified as: ${llmClassification}`);
      return llmClassification;
    } catch (error) {
      console.warn(
        'LLM classification failed, falling back to keyword-based classification:',
        error,
      );
      return this.classifyWithKeywords(question);
    }
  }

  private async classifyWithLLM(question: string): Promise<QueryType> {
    const prompt = `You are an expert HR query classifier. Classify the following question into one of these categories:

1. "personal" - Questions about the user's own employment information (using "my", "I", "me", "am I", etc.)
2. "employee" - Questions about other specific employees or staff members (by name or role, using "who", "employee", "staff", etc.)
3. "policy" - Questions about company policies, procedures, rules, or general HR information that apply to everyone
4. "mixed" - Questions that combine elements from multiple categories

Classification Rules:
- If the question uses first-person pronouns (I, my, me, am I, do I, can I) → "personal"
- If the question asks about specific people by name or role (John Smith, manager of X, who works in Y) → "employee"
- If the question asks about "employees" in general, their rights, benefits, or rules that apply to all → "policy"
- If the question contains words like "rights", "benefits", "policy", "procedure", "rules" → "policy"
- If the question asks about company-wide policies, procedures, or rules → "policy"
- If the question combines multiple elements → "mixed"

Examples:
English:
- "What is my salary?" → personal
- "What is John Smith's position?" → employee
- "Who is the manager of HR department?" → employee  
- "What is Susan's department?" → employee
- "What is the vacation policy?" → policy
- "How do I request leave for my vacation?" → mixed (personal action + policy)
- "What are the company benefits?" → policy
- "When is my performance review?" → personal
- "How do I submit my timesheet?" → mixed (personal action + procedure)
- "Find employee in accounting department" → employee
- "Who works in IT?" → employee


Mongolian:
- "Миний цалин хэд вэ?" → personal
- "Нурболын албан тушаал юу вэ?" → employee
- "Амралтын журам юу вэ?" → policy
- "Ажилтны эрх юу вэ?" → policy (employee rights)
- "Ажилтан хэрхэн амралт авах вэ?" → policy (how employees take leave)
- "Ажилчдын цалингийн бодлого?" → policy (employee salary policy)
- "Хэн ажилладаг санхүүгийн хэлтэст?" → employee



Question: "${question}"

Respond with ONLY one word: personal, employee, policy, or mixed`;

    const response = await this.llm.invoke(prompt);
    const classification = (response.content as string).toLowerCase().trim();

    // Validate the response
    if (['personal', 'employee', 'policy', 'mixed'].includes(classification)) {
      return classification as QueryType;
    } else {
      console.warn(
        `Invalid LLM classification response: ${classification}, falling back to keywords`,
      );
      return this.classifyWithKeywords(question);
    }
  }

  private classifyWithKeywords(question: string): QueryType {
    const lowerQuestion = question.toLowerCase().trim();
    console.log('Classifying question with keywords:', lowerQuestion);

    const hasPersonal = [
      ...this.personalKeywords.english,
      ...this.personalKeywords.mongolian,
    ].some((keyword) => lowerQuestion.includes(keyword.toLowerCase()));

    const hasEmployee = [
      ...this.employeeKeywords.english,
      ...this.employeeKeywords.mongolian,
    ].some((keyword) => lowerQuestion.includes(keyword.toLowerCase()));

    const hasPolicy = [
      ...this.policyKeywords.english,
      ...this.policyKeywords.mongolian,
    ].some((keyword) => lowerQuestion.includes(keyword.toLowerCase()));

    const hasFirstPerson = /\b(i|my|me|am i|do i|can i|will i)\b/i.test(
      lowerQuestion,
    );

    const hasWhoQuestion = /\b(who|хэн)\b/i.test(lowerQuestion);

    // Determine classification based on keyword combinations
    let classification: QueryType;

    // Count how many types are detected
    const typeCount = [hasPersonal, hasEmployee, hasPolicy].filter(
      Boolean,
    ).length;

    if (typeCount > 1) {
      classification = 'mixed';
    } else if (hasPersonal || hasFirstPerson) {
      classification = 'personal';
    } else if (hasEmployee || hasWhoQuestion) {
      classification = 'employee';
    } else if (hasPolicy) {
      classification = 'policy';
    } else {
      // Default fallback
      classification = 'policy';
    }

    console.log(`Keyword-based classification result: ${classification}`);
    console.log(
      `📊 Detection flags - Personal: ${hasPersonal}, Employee: ${hasEmployee}, Policy: ${hasPolicy}, FirstPerson: ${hasFirstPerson}, Who: ${hasWhoQuestion}`,
    );

    return classification;
  }

  //   /**
  //    * Get classification confidence score (useful for debugging/monitoring)
  //    */
  //   getClassificationMetrics(question: string): {
  //     personalScore: number;
  //     employeeScore: number;
  //     policyScore: number;
  //   } {
  //     const lowerQuestion = question.toLowerCase();

  //     const personalMatches = [
  //       ...this.personalKeywords.english,
  //       ...this.personalKeywords.mongolian,
  //     ].filter((keyword) => lowerQuestion.includes(keyword.toLowerCase())).length;

  //     const employeeMatches = [
  //       ...this.employeeKeywords.english,
  //       ...this.employeeKeywords.mongolian,
  //     ].filter((keyword) => lowerQuestion.includes(keyword.toLowerCase())).length;

  //     const policyMatches = [
  //       ...this.policyKeywords.english,
  //       ...this.policyKeywords.mongolian,
  //     ].filter((keyword) => lowerQuestion.includes(keyword.toLowerCase())).length;

  //     return {
  //       personalScore: personalMatches,
  //       employeeScore: employeeMatches,
  //       policyScore: policyMatches,
  //     };
  //   }
}
