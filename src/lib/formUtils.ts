import { format as formatDate, parse as parseDate } from "date-fns";

export type ReplacedType<T extends object, _FROM, TO, K extends [...(keyof T)[]]> = 
  { [K2 in keyof T]: K[number] extends K2 ? TO : T[K2] };

function replacePropertiesType<T extends object, FROM, TO, K extends [...(keyof T)[]]>
(obj:T, transform: (from: FROM) => TO, ...keys: K): ReplacedType<T, FROM, TO, K> {
  let ret = {} as ReplacedType<T, FROM, TO, K>;

  let key: keyof typeof obj;
  for (key in obj) {
    if (!keys.includes(key)) {
      ret[key] = obj[key] as any;
    } else {
      ret[key] = transform(obj[key] as FROM) as any;
    }
  }

  return ret;
}

export function toExpandedDates<T extends object, K extends [...(keyof T)[]]>(obj: T, ...keys: K): ReplacedType<T, number, { date: string, time: string }, K> {
  const transform = (time: number) => {
    return {
      date: formatDate(time, 'yyyy-MM-dd'),
      time: formatDate(time, 'HHmm')
    };
  };
  return replacePropertiesType<T, number, { date: string, time: string }, K>(obj, transform, ...keys);
}

export function fromExpandedDates<T extends object, K extends [...(keyof T)[]]>(obj: ReplacedType<T, number, { date: string, time: string }, K>, ...keys: K): T {
  const transform = ({date, time}: { date: string, time: string }) => {
    const parsed = parseDate(`${date} ${time}`, 'yyyy-MM-dd HHmm', new Date());
    return parsed.getTime();
  };
  return replacePropertiesType<T, { date: string, time: string }, number, K>(obj as any, transform, ...keys) as T;
}
