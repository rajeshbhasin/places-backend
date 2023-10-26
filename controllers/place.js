const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const HttpError = require('../models/http-error');
const getCoordinatesForAddress = require('../util/location');

const Place = require('../models/place');
const User = require('../models/users');
const fs = require('fs');

const getPlaceById = async (req, res, next) => {
  console.log('Get request in places  ');
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (error) {
    return next(new HttpError('Could not find the place', 500));
  }

  if (!place) {
    return next(new HttpError('Place was not found!', 404));
  }
  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let places;
  try {
    places = await Place.find({ creator: userId });
  } catch (error) {
    console.log(error);
    return next(new HttpError('Could not find the places by this user', 500));
  }

  //this was earlier for case where places were 0 so i just let it pass normally since it was causing
  //page to not load on empty places case.
  //return next(new HttpError('Place was not found with this user!', 404));

  res.json({ places: places.map((p) => p.toObject({ getters: true })) });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError('Invalid Inputs Passed ', 422));
  }

  const { title, description, address } = req.body;
  let coords;
  try {
    coords = await getCoordinatesForAddress(address);
  } catch (error) {
    return next(error); //since throwing error wont work in async
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    creator: req.userData.userId,
    location: coords,
    image: req.file.path,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError('Creating place failed', 500);
    return next(error);
  }

  if (!user) {
    return next(new HttpError('We could not find the user with given Id', 404));
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await createdPlace.save({ session: session });
    user.places.push(createdPlace);
    await user.save({ session: session });
    await session.commitTransaction();
  } catch (error) {
    const er = new HttpError('Create place failed.Try again', 500);
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlaceById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid Inputs Passed ' + JSON.stringify(errors), 422)
    );
  }
  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (error) {
    const err = new HttpError('Something went wrong', 500);
    return next(err);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const err = new HttpError('Not allowed to edit this place', 401);
    return next(err);
  }
  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (error) {
    const err = new HttpError('Something went wrong', 500);
    return next(err);
  }

  return res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlaceById = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;

  try {
    place = await Place.findById(placeId).populate('creator');
  } catch (error) {
    console.log(error);
    const err = new HttpError(
      'Something went wrong.Could not delete place',
      500
    );
    return next(err);
  }

  if (!place) {
    const error = new HttpError('We could not find place with this Id', 404);
    return next(error);
  }

  if (place.creator.id !== req.userData.userId) {
    const err = new HttpError('Not allowed to delete this place', 401);
    return next(err);
  }

  const imagePath = place.image;

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await Place.findOneAndDelete({ _id: placeId });
    place.creator.places.pull(place);
    await place.creator.save({ session: session });
    await session.commitTransaction();
  } catch (error) {
    console.log(error);
    return next(new HttpError('Could not delete place', 404));
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });
  return res.status(200).json({ message: 'Place deleted' });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlaceById = updatePlaceById;
exports.deletePlaceById = deletePlaceById;
