const Address = require("../models/Address");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const dto = (a) => ({
  id: a._id,
  label: a.label,
  line1: a.line1,
  city: a.city,
  phone: a.phone,
  lat: a.location.coordinates[1],
  lng: a.location.coordinates[0],
  isDefault: a.isDefault,
});

exports.list = asyncHandler(async (req, res) => {
  const list = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
  res.json({ success: true, addresses: list.map(dto) });
});

exports.create = asyncHandler(async (req, res) => {
  const { lat, lng, isDefault, ...rest } = req.body;
  if ((await Address.countDocuments({ user: req.user._id })) >= 10) throw new ApiError(409, "Address limit reached", "ADDRESS_LIMIT");
  const first = !(await Address.exists({ user: req.user._id }));
  if (isDefault) await Address.updateMany({ user: req.user._id }, { isDefault: false });
  const a = await Address.create({
    ...rest,
    user: req.user._id,
    location: { type: "Point", coordinates: [lng, lat] },
    isDefault: first || !!isDefault, // pehla address khud default
  });
  res.status(201).json({ success: true, address: dto(a) });
});

exports.update = asyncHandler(async (req, res) => {
  const a = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!a) throw new ApiError(404, "Address not found", "ADDRESS_NOT_FOUND");
  const { lat, lng, isDefault, ...rest } = req.body;
  Object.assign(a, rest);
  if (lat != null || lng != null)
    a.location = { type: "Point", coordinates: [lng ?? a.location.coordinates[0], lat ?? a.location.coordinates[1]] };
  if (isDefault) {
    await Address.updateMany({ user: req.user._id }, { isDefault: false });
    a.isDefault = true;
  }
  await a.save();
  res.json({ success: true, address: dto(a) });
});

exports.remove = asyncHandler(async (req, res) => {
  const a = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!a) throw new ApiError(404, "Address not found", "ADDRESS_NOT_FOUND");
  if (a.isDefault) {
    const next = await Address.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    if (next) await Address.updateOne({ _id: next._id }, { isDefault: true });
  }
  res.json({ success: true });
});
