export const route = (courseId, weekId, dayId, lessonId) => ['/course', courseId, weekId && 'week', weekId, dayId && 'day', dayId, lessonId && 'lesson', lessonId].filter(Boolean).join('/');
export const homeworkRoute = (courseId, weekId, dayId, lessonId) => `${route(courseId, weekId, dayId, lessonId)}/homework`;
