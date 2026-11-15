import Foundation
import HealthKit
import Capacitor

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "ZernoHealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecentRunningWorkouts", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()
    private let isoFormatter = ISO8601DateFormatter()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health is not available on this device", "HEALTHKIT_UNAVAILABLE")
            return
        }
        let workoutType = HKObjectType.workoutType()
        guard let distanceType = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) else {
            call.reject("Running distance type is unavailable", "HEALTHKIT_TYPE_UNAVAILABLE")
            return
        }
        healthStore.requestAuthorization(toShare: [], read: [workoutType, distanceType]) { _, error in
            if let error = error {
                call.reject("Could not request Apple Health permissions", "HEALTHKIT_AUTHORIZATION_FAILED", error)
                return
            }
            // HealthKit intentionally does not reveal whether read access was granted.
            call.resolve(["authorizationRequested": true])
        }
    }

    @objc func getRecentRunningWorkouts(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health is not available on this device", "HEALTHKIT_UNAVAILABLE")
            return
        }
        // Keep the iOS query window and page size aligned with the Android adapter.
        let days = min(max(call.getInt("days") ?? 30, 1), 30)
        let limit = min(max(call.getInt("limit") ?? 25, 1), 25)
        let scanLimit = 500
        let start = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: scanLimit,
            sortDescriptors: [sort]
        ) { [weak self] _, samples, error in
            guard let self = self else {
                call.reject("HealthKit query could not be completed", "HEALTHKIT_QUERY_FAILED")
                return
            }
            if let error = error {
                call.reject("Could not read Apple Health workouts", "HEALTHKIT_QUERY_FAILED", error)
                return
            }
            let workouts = (samples as? [HKWorkout] ?? []).compactMap { workout -> [String: Any]? in
                guard workout.workoutActivityType == .running else { return nil }
                let source = workout.sourceRevision.source
                let device = workout.device
                let distance = workout.totalDistance?.doubleValue(for: HKUnit.meter()) ?? 0
                return [
                    "id": workout.uuid.uuidString,
                    "activityType": "running",
                    "startedAt": self.isoFormatter.string(from: workout.startDate),
                    "endedAt": self.isoFormatter.string(from: workout.endDate),
                    "durationSeconds": Int(workout.duration.rounded()),
                    "distanceMeters": Int(distance.rounded()),
                    "sourceName": source.name,
                    "sourceBundleIdentifier": source.bundleIdentifier,
                    "deviceName": device?.name ?? "",
                    "deviceModel": device?.model ?? "",
                    "sourceProductType": device?.productType ?? ""
                ]
            }.prefix(limit).map { $0 }
            call.resolve(["workouts": workouts])
        }
        healthStore.execute(query)
    }
}
