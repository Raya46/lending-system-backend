import express from "express";
import { validationResult, checkSchema, cookie } from "express-validator";
import { createValidationSkema } from "../skema/skemaValidasi.mjs";
import { mockUsers } from "../data/users.mjs"; // Import mockUsers

const router = express.Router();

// buat Middleware dengan function Validasi ID
function validateId(req, res, next) {
  const { params } = req;
  const idParamName = Object.keys(params)[0];
  const idValue = params[idParamName];
  const parsedId = parseInt(idValue);

  //kalo gk ada isi paramnya ato hasilnya NaN maka error
  if (!idParamName || isNaN(parsedId)) {
    return res
      .status(400)
      .send({ msg: `Bad request, invalid ${idParamName || "ID"}.` });
  }

  req.parsedId = parsedId;
  next();
}

/*
    dokumentasi: 
    https://expressjs.com/en/api.html#req.signedCookies  
    https://expressjs.com/en/api.html#req.cookies
*/

router.get("/", (req, res) => {
  console.log(req.headers.cookie);
  console.log(req.cookies);
  console.log(req.signedCookies);

  if (req.signedCookies.hello && req.signedCookies.hello === "world") {
  console.log(req.query);
  //ambil filter dan value dari query di module request "req"
  const {
    query: { filter, value },
  } = req;
  // tetrary function (if elsenya excel)
  return filter && value
    ? res.send(
        mockUsers.filter((user) => {
            user[filter] && user[filter].includes(value);
        })
      )
    : res.status(200).send(mockUsers);

  /* ini yang pake if else normal
  if (filter && value) {
    return res.send(
      mockUsers.filter((user) =>
            user[filter].includes(value)
          ));
  } else
      return res.status(200).send(mockUsers);
  */    
  }
});

//untuk ngirim data
router.post("/", checkSchema(createValidationSkema), (req, res) => {
  console.log("Request body:", req.body);
  const result = validationResult(req);
  console.log(result);

  if (!result.isEmpty()) {
    return res.status(400).send({ error: result.array() });
  }
  const data = matchedData(req);
  const newUsers = { id: mockUsers[mockUsers.length - 1].id + 1, ...data };
  mockUsers.push(newUsers);
  return res.status(201).send(newUsers);
});
//untuk ambil data
//gunakan middleware validateId
router.get("/:id", validateId, (req, res) => {
  const findUser = mockUsers.find((user) => user.id === req.parsedId);
  if (!findUser) {
    return res.sendStatus(404);
  }
  return res.send(findUser);
});

//untuk benerin keseluruhan 1 row data
//gunakan middleware validateId
router.put("/:id", validateId, (req, res) => {
  const { body } = req;
  const findUserIndex = mockUsers.findIndex((user) => user.id === req.parsedId);

  if (findUserIndex === -1) {
    return res.sendStatus(404);
  }
  mockUsers[findUserIndex] = { id: req.parsedId, ...body };
  return res.sendStatus(200);
});

//untuk benerin satu bagian di data
//gunakan middleware validateId
router.patch("/:id", validateId, (req, res) => {
  const { body } = req;
  const findUserIndex = mockUsers.findIndex((user) => user.id === req.parsedId);
  if (findUserIndex === -1) {
    return res.sendStatus(404);
  }
  mockUsers[findUserIndex] = { ...mockUsers[findUserIndex], ...body };
  return res.sendStatus(200);
});

//untuk ngapus keseluruhan 1 row data
//gunakan middleware validateId
router.delete("/:id", validateId, (req, res) => {
  const findUserIndex = mockUsers.findIndex((user) => user.id === req.parsedId);
  if (findUserIndex === -1) {
    return res.sendStatus(404);
  }
  mockUsers.splice(findUserIndex, 1);
  return res.sendStatus(200);
});

export default router;
