import { Injectable } from '@nestjs/common';

export type QueryType = 'personal' | 'policy' | 'mixed';

@Injectable()
export class QueryClassifierService {
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
      'sick leave',
      'benefits',
      'hiring',
      'onboarding',
      'performance review',
      'code of conduct',
    ],
    mongolian: [
      'журам',
      'дүрэм',
      'бодлого',
      'үйл ажиллагаа',
      'хэрхэн',
      'юу вэ',
      'амралтын журам',
      'өвчтэй амралт',
      'тэтгэмж',
      'ажилд авах',
      'үнэлгээ',
      'ёс зүйн дүрэм',
    ],
  };

  classifyQuery(question: string): QueryType {
    const lowerQuestion = question.toLowerCase();
    console.log('🔍 Classifying question:', lowerQuestion);

    const hasPersonal = [
      ...this.personalKeywords.english,
      ...this.personalKeywords.mongolian,
    ].some((keyword) => lowerQuestion.includes(keyword.toLowerCase()));

    const hasPolicy = [
      ...this.policyKeywords.english,
      ...this.policyKeywords.mongolian,
    ].some((keyword) => lowerQuestion.includes(keyword.toLowerCase()));

    let classification: QueryType;
    if (hasPersonal && hasPolicy) {
      classification = 'mixed';
    } else if (hasPersonal) {
      classification = 'personal';
    } else {
      classification = 'policy';
    }

    console.log(`📋 Query classified as: ${classification}`);
    return classification;
  }
}
