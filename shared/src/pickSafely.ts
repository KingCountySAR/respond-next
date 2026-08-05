export const pickSafely = <ObjectType>(keys: readonly `${string & keyof ObjectType}`[]) => {
  return <Input extends ObjectType>(object: Input) => {
    const resultObject: ObjectType = {} as unknown as ObjectType;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index] as unknown as keyof ObjectType;
      resultObject[key] = object[key];
    }

    return resultObject as ObjectType;
  };
};
