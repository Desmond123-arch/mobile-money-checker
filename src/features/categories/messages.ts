import type { AddKeywordResult, CreateCategoryResult } from '@/ledger/categories';

type Problem = Exclude<CreateCategoryResult | AddKeywordResult, { ok: true }>;

const quoted = (word: string) => `“${word}”`;

/** Plain-language reason a category or word could not be saved. */
export function problemMessage(
  problem: Problem,
  subject: { word?: string; name?: string },
): string {
  switch (problem.reason) {
    case 'empty':
      return subject.name === undefined ? 'Type a word first.' : 'Give the category a name.';
    case 'duplicate':
      return `You already have a category called ${quoted(subject.name ?? '')}.`;
    case 'colour':
      return 'Pick one of the colours.';
    case 'tooCommon':
      return `${quoted('word' in problem ? problem.word : (subject.word ?? ''))} is too common to file payments. Try something more specific.`;
    case 'elsewhere':
      return `${quoted('word' in problem ? problem.word : (subject.word ?? ''))} already files payments under ${problem.category}. Remove it there first.`;
    case 'noWords':
      return 'Words do not file payments here. Family and Friends use the names in Settings; Income, Cash and Other come from the kind of payment.';
  }
}
