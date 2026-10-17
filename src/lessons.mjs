/** Original, beginner-level material; not copied from a third-party course. */
export const lessons = [
  {
    id: 'greetings', unit: 1, title: 'Say hello', subtitle: 'Greetings and polite words',
    goal: 'Recognize and use familiar greetings and courtesy words.',
    questions: [
      { id: 'g1', kind: 'choice', prompt: 'What does “hola” mean?', options: ['Hello', 'Goodbye', 'Please'], answer: 'Hello', explanation: 'Hola is the everyday way to say hello.' },
      { id: 'g2', kind: 'choice', prompt: 'Choose the Spanish word for “thank you”.', options: ['Perdón', 'Gracias', 'Adiós'], answer: 'Gracias', explanation: 'Gracias means thank you. Perdón means sorry or excuse me.' },
      { id: 'g3', kind: 'type', prompt: 'Write “good morning” in Spanish.', placeholder: 'Type in Spanish', answer: 'Buenos días', accepted: ['buenos días'], explanation: 'Buenos días is a common morning greeting. Keep the accent on í.' },
      { id: 'g4', kind: 'listen', prompt: 'Listen and choose the word you hear.', spoken: 'Adiós', options: ['Adiós', 'Hola', 'Gracias'], answer: 'Adiós', explanation: 'Adiós means goodbye. The stress falls on the accented ó.' },
      { id: 'g5', kind: 'type', prompt: 'Write “please” in Spanish.', placeholder: 'Type in Spanish', answer: 'Por favor', accepted: ['por favor'], explanation: 'Por favor is the usual way to say please.' }
    ]
  },
  {
    id: 'introductions', unit: 1, title: 'Introduce yourself', subtitle: 'Names and first conversations',
    goal: 'Understand a name question and give a basic introduction.',
    questions: [
      { id: 'i1', kind: 'choice', prompt: 'Someone asks: “¿Cómo te llamas?” What do they want to know?', options: ['Your name', 'Your age', 'Where you live'], answer: 'Your name', explanation: '¿Cómo te llamas? asks What is your name? in informal Spanish.' },
      { id: 'i2', kind: 'type', prompt: 'Complete: “Me ____ Alex.” (My name is Alex.)', placeholder: 'Missing Spanish word', answer: 'llamo', accepted: ['llamo'], explanation: 'Me llamo is the most common introductory phrase for saying your name.' },
      { id: 'i3', kind: 'choice', prompt: 'What does “Mucho gusto” mean when meeting somebody?', options: ['See you tomorrow', 'Nice to meet you', 'I am hungry'], answer: 'Nice to meet you', explanation: 'Mucho gusto is a polite way to say nice to meet you.' },
      { id: 'i4', kind: 'listen', prompt: 'Listen. Which expression was spoken?', spoken: 'Me llamo Lucía', options: ['Me llamo Lucía', 'Hasta mañana', 'Buenos días'], answer: 'Me llamo Lucía', explanation: 'Me llamo Lucía means My name is Lucía.' },
      { id: 'i5', kind: 'type', prompt: 'Write “nice to meet you” in Spanish.', placeholder: 'Type in Spanish', answer: 'Mucho gusto', accepted: ['mucho gusto'], explanation: 'Mucho gusto is a natural way to greet someone you have just met.' }
    ]
  }
];

const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('es').replace(/\s+/g, ' ').replace(/[.!?¿¡]+$/g, '');
export function gradeQuestion(question, submission) {
  if (!question) throw new Error('Unknown question');
  const accepted = question.kind === 'type' ? (question.accepted ?? [question.answer]) : [question.answer];
  const correct = accepted.some(a => normalize(a) === normalize(submission));
  return { id: question.id, correct, answer: question.answer, explanation: question.explanation };
}
export function gradeLesson(lesson, submitted = {}) {
  const results = lesson.questions.map(q => gradeQuestion(q, submitted[q.id]));
  const correctCount = results.filter(r => r.correct).length;
  const percent = Math.round(100 * correctCount / results.length);
  return { results, correctCount, total: results.length, percent, passed: percent >= 80 };
}
export function publicLesson(lesson) {
  return {
    id: lesson.id, unit: lesson.unit, title: lesson.title, subtitle: lesson.subtitle, goal: lesson.goal,
    questions: lesson.questions.map(({ id, kind, prompt, placeholder, options, spoken }) => ({
      id, kind, prompt, ...(placeholder ? { placeholder } : {}),
      ...(options ? { options } : {}), ...(spoken ? { spoken } : {})
    }))
  };
}
export function findLesson(id) { return lessons.find(l => l.id === id); }
export function isUnlocked(id, rows = []) {
  const index = lessons.findIndex(l => l.id === id);
  if (index < 0) return false;
  if (index === 0) return true;
  const previous = rows.find(r => r.lesson_id === lessons[index - 1].id);
  return Number(previous?.best_percent ?? 0) >= 80;
}
