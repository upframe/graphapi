FROM lambci/lambda:build-nodejs12.x

COPY . .

RUN npm install

RUN source ./credentials && npx sls deploy