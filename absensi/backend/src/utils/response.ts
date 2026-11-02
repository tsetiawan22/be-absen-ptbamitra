export const ok = (data: any = null, message = "OK") => ({
  success: true,
  message,
  data,
});

export const fail = (message: string, code = 400) => ({
  success: false,
  message,
  data: null,
});
