import app from "../../index.mjs";

export default function apiHandler(event) {
  const request = event.node.req;
  const response = event.node.res;

  return new Promise((resolve, reject) => {
    const finish = () => resolve(undefined);
    response.once("finish", finish);
    response.once("close", finish);

    app(request, response, (error) => {
      if (error) {
        reject(error);
        return;
      }
      if (!response.writableEnded) {
        response.statusCode = 404;
        response.end();
      }
    });
  });
}
